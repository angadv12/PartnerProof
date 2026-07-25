/**
 * Service layer — the business logic behind every API route.
 *
 * Routes stay thin and call these functions; the functions own all reads/writes
 * and roll-up logic. This is the natural place to add validation, auth, or a
 * different persistence backend later.
 *
 * Server-only.
 */
import fs from "node:fs";
import path from "node:path";

import { getAssistant } from "./assistant";
import { ACTIVE_TEAM_ID } from "./constants";
import { getDb, saveDb, resetDb } from "./db";
import { getContractExtractor } from "./extractor";
import { formatCompactCurrency } from "./format";
import {
  contractWithStats,
  dashboardSummary,
  enrichEvidence,
  statusCounts,
} from "./metrics";
import { getSearchEngine } from "./search";
import {
  EVIDENCE_PREFIX,
  contentTypeForName,
  getStorage,
  storageUrl,
} from "./storage";
import type {
  AssistantResponse,
  Contract,
  ContractDetail,
  ContractWithStats,
  CreateContractInput,
  DashboardSummary,
  Deliverable,
  DeliverableFilters,
  DeliverableWithContext,
  Evidence,
  EvidenceWithContext,
  ExtractedDeliverable,
  ExtractionContext,
  RecapReport,
  RecapView,
  Sponsor,
  Team,
  UpdateDeliverableInput,
  UploadEvidenceInput,
} from "./types";
import { generateId } from "./utils";

const nowIso = () => new Date().toISOString();
const todayDate = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

export function listSponsors(): Sponsor[] {
  return getDb().sponsors;
}

export function listTeams(): Team[] {
  return getDb().teams;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function getDashboard(): DashboardSummary {
  return dashboardSummary(getDb());
}

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

export function listContracts(): ContractWithStats[] {
  const db = getDb();
  return db.contracts
    .map((c) => contractWithStats(db, c))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getContractDetail(id: string): ContractDetail | null {
  const db = getDb();
  const contract = db.contracts.find((c) => c.id === id);
  if (!contract) return null;
  return {
    ...contractWithStats(db, contract),
    deliverables: db.deliverables
      .filter((d) => d.contractId === id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    evidence: db.evidence
      .filter((e) => e.contractId === id)
      .sort((a, b) => b.activationDate.localeCompare(a.activationDate))
      .map((e) => enrichEvidence(db, e)),
  };
}

export function createContract(input: CreateContractInput): ContractWithStats {
  const db = getDb();
  const name = input.sponsorName.trim();

  // Reuse an existing sponsor (case-insensitive) or create a new one.
  let sponsor = db.sponsors.find((s) => s.name.toLowerCase() === name.toLowerCase());
  if (!sponsor) {
    sponsor = {
      id: generateId("sp"),
      name,
      industry: input.sponsorIndustry?.trim() || "—",
    };
    db.sponsors.push(sponsor);
  }

  const team = db.teams.find((t) => t.id === ACTIVE_TEAM_ID) ?? db.teams[0];
  const created = nowIso();
  const contract: Contract = {
    id: generateId("ct"),
    teamId: team?.id ?? ACTIVE_TEAM_ID,
    sponsorId: sponsor.id,
    name: input.name.trim(),
    season: input.season.trim(),
    startDate: input.startDate || todayDate(),
    endDate: input.endDate || todayDate(),
    value: input.value,
    status: "Active",
    rawText: input.rawText,
    createdAt: created,
  };
  db.contracts.push(contract);

  for (const ex of input.deliverables) {
    const deliverable: Deliverable = {
      id: generateId("dl"),
      contractId: contract.id,
      sponsorId: sponsor.id,
      title: ex.title.trim(),
      description: ex.description.trim(),
      category: ex.category,
      dueDate: ex.dueDate || undefined,
      quantityRequired: Math.max(1, ex.quantityRequired),
      quantityDelivered: 0,
      status: "Pending",
      priority: ex.priority,
      sourceText: ex.sourceText,
      notes: ex.unit ? `Tracked in ${ex.unit}.` : undefined,
      createdAt: created,
      updatedAt: created,
    };
    db.deliverables.push(deliverable);
  }

  saveDb(db);
  return contractWithStats(db, contract);
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

export async function extractDeliverables(
  text: string,
  context: ExtractionContext
): Promise<ExtractedDeliverable[]> {
  return getContractExtractor().extract(text, context);
}

// ---------------------------------------------------------------------------
// Deliverables
// ---------------------------------------------------------------------------

function withContext(db: ReturnType<typeof getDb>, d: Deliverable): DeliverableWithContext {
  return {
    ...d,
    sponsorName: db.sponsors.find((s) => s.id === d.sponsorId)?.name ?? "—",
    contractName: db.contracts.find((c) => c.id === d.contractId)?.name ?? "—",
  };
}

/** Searchable text for a deliverable; matches the original haystack fields. */
const deliverableText = (d: Deliverable) => `${d.title} ${d.description} ${d.notes ?? ""}`;

export async function listDeliverables(
  filters: DeliverableFilters = {}
): Promise<DeliverableWithContext[]> {
  const db = getDb();

  // Apply the structured filters first (cheap, and narrows the candidate set so
  // semantic search only has to embed the survivors).
  const candidates = db.deliverables.filter((d) => {
    if (filters.status && d.status !== filters.status) return false;
    if (filters.category && d.category !== filters.category) return false;
    if (filters.sponsorId && d.sponsorId !== filters.sponsorId) return false;
    if (filters.contractId && d.contractId !== filters.contractId) return false;
    if (filters.priority && d.priority !== filters.priority) return false;
    return true;
  });

  // Free-text search is hybrid keyword+semantic; an empty query is a no-op and
  // returns the candidates unchanged. Falls back to exact substring if the
  // embedding model is unavailable.
  const search = filters.search?.trim() ?? "";
  const matched = await getSearchEngine().search(search, candidates, deliverableText);

  return matched.map((d) => withContext(db, d));
}

export function updateDeliverable(
  id: string,
  input: UpdateDeliverableInput
): DeliverableWithContext | null {
  const db = getDb();
  const d = db.deliverables.find((x) => x.id === id);
  if (!d) return null;

  if (input.title !== undefined) d.title = input.title;
  if (input.description !== undefined) d.description = input.description;
  if (input.category !== undefined) d.category = input.category;
  if (input.dueDate !== undefined) d.dueDate = input.dueDate ?? undefined;
  if (input.quantityRequired !== undefined) {
    d.quantityRequired = Math.max(1, input.quantityRequired);
  }
  if (input.priority !== undefined) d.priority = input.priority;
  if (input.notes !== undefined) d.notes = input.notes;
  if (input.quantityDelivered !== undefined) {
    d.quantityDelivered = Math.max(0, input.quantityDelivered);
  }

  // Smart status sync: marking Delivered fills the quantity; hitting the target
  // auto-completes; dropping below a completed target reopens the item.
  if (input.status !== undefined) {
    d.status = input.status;
    if (input.status === "Delivered" && input.quantityDelivered === undefined) {
      d.quantityDelivered = d.quantityRequired;
    }
  } else if (input.quantityDelivered !== undefined) {
    if (d.quantityDelivered >= d.quantityRequired) d.status = "Delivered";
    else if (d.status === "Delivered") d.status = "Pending";
  }

  d.updatedAt = nowIso();
  saveDb(db);
  return withContext(db, d);
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export function listEvidence(sponsorId?: string): EvidenceWithContext[] {
  const db = getDb();
  return db.evidence
    .filter((e) => !sponsorId || e.sponsorId === sponsorId)
    .sort((a, b) => b.activationDate.localeCompare(a.activationDate))
    .map((e) => enrichEvidence(db, e));
}

export async function uploadEvidence(
  input: UploadEvidenceInput,
): Promise<EvidenceWithContext | null> {
  // Validate against a throwaway snapshot so a bad ID costs no upload. The
  // snapshot used for the actual mutation is read *after* the await below.
  if (!getDb().deliverables.some((d) => d.id === input.deliverableId)) return null;

  const id = generateId("ev");
  let filePath: string | undefined;

  if (input.fileBuffer && input.fileName) {
    const ext = path.extname(input.fileName) || "";
    const key = `${EVIDENCE_PREFIX}/${id}${ext}`;
    // Write the object before the DB row, so a failed upload never leaves a
    // record pointing at a file that does not exist.
    await getStorage().put(key, input.fileBuffer, contentTypeForName(input.fileName));
    filePath = storageUrl(key);
  }

  // Read-modify-write has to happen with no await in between: the store is a
  // whole-file JSON snapshot, so saving one read before the upload would clobber
  // any write that landed while the upload was in flight.
  const db = getDb();
  const deliverable = db.deliverables.find((d) => d.id === input.deliverableId);
  // Could have been deleted while the file uploaded.
  if (!deliverable) return null;

  const evidence: Evidence = {
    id,
    deliverableId: deliverable.id,
    contractId: deliverable.contractId,
    sponsorId: deliverable.sponsorId,
    title: input.title.trim(),
    type: input.type,
    url: input.url?.trim() || undefined,
    filePath,
    description: input.description.trim(),
    activationDate: input.activationDate || todayDate(),
    uploadedBy: input.uploadedBy?.trim() || "Partnerships Team",
    createdAt: nowIso(),
  };
  db.evidence.push(evidence);
  saveDb(db);
  return enrichEvidence(db, evidence);
}

// ---------------------------------------------------------------------------
// Recap report
// ---------------------------------------------------------------------------

export function generateRecap(contractId: string): RecapView | null {
  const db = getDb();
  const contract = db.contracts.find((c) => c.id === contractId);
  if (!contract) return null;

  const stats = contractWithStats(db, contract);
  const sponsor = stats.sponsor;
  const deliverables = db.deliverables.filter((d) => d.contractId === contractId);
  const evidence = db.evidence
    .filter((e) => e.contractId === contractId)
    .sort((a, b) => b.activationDate.localeCompare(a.activationDate))
    .map((e) => enrichEvidence(db, e));

  const delivered = deliverables.filter((d) => d.status === "Delivered");
  const openItems = deliverables.filter((d) => d.status !== "Delivered");
  const counts = statusCounts(deliverables);

  const summary =
    `Through the ${contract.season} season, ${sponsor.name} reached ${stats.fulfillment}% fulfillment ` +
    `across ${deliverables.length} contracted activations, with ${counts.delivered} fully delivered and ` +
    `${evidence.length} pieces of activation proof on file.`;

  const highlights = [
    `${stats.fulfillment}% of contracted deliverables fulfilled across ${deliverables.length} activations`,
    ...delivered
      .slice(0, 4)
      .map(
        (d) =>
          `${d.title}${d.quantityRequired > 1 ? ` — ${d.quantityDelivered}/${d.quantityRequired} completed` : " — completed"}`
      ),
    evidence.length ? `${evidence.length} pieces of activation evidence captured and shareable` : "",
  ].filter(Boolean);

  const renewalTalkingPoints = [
    `${sponsor.name} received ${counts.delivered} fully delivered activations this season.`,
    counts.missed > 0
      ? `Acknowledge ${counts.missed} item${counts.missed === 1 ? "" : "s"} that slipped and propose a make-good (bonus inventory) into next season.`
      : `Clean delivery record — no missed obligations to address.`,
    counts.atRisk > 0
      ? `Close out ${counts.atRisk} in-flight item${counts.atRisk === 1 ? "" : "s"} before renewal to finish strong.`
      : `All in-flight items are on track heading into renewal.`,
    `Anchor renewal pricing on proven delivery and ${formatCompactCurrency(contract.value)} of activated partnership value.`,
  ];

  const report: RecapReport = {
    id: generateId("rc"),
    contractId,
    title: `${sponsor.name} ${contract.season} Activation Recap`,
    summary,
    highlights,
    renewalTalkingPoints,
    createdAt: nowIso(),
  };

  // Keep one recap per contract so the history doesn't pile up in the MVP.
  db.recapReports = [...db.recapReports.filter((r) => r.contractId !== contractId), report];
  saveDb(db);

  return { report, contract: stats, delivered, openItems, evidence };
}

// ---------------------------------------------------------------------------
// Assistant
// ---------------------------------------------------------------------------

export async function askAssistant(query: string): Promise<AssistantResponse> {
  return getAssistant().answer(query, getDb());
}

// ---------------------------------------------------------------------------
// Demo utilities
// ---------------------------------------------------------------------------

/** Restore the seed dataset (handy during a live demo). */
export function resetData(): void {
  resetDb();
}
