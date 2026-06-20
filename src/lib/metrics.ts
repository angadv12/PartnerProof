/**
 * Pure roll-up calculations over the database.
 *
 * Kept free of I/O so the same functions can power API responses today and a
 * cached/materialized view later. Fulfillment is computed from delivered vs.
 * required quantities so partial progress is reflected, not just binary status.
 */
import { clampPercent, daysUntil } from "./format";
import type {
  Contract,
  ContractWithStats,
  Database,
  DashboardSummary,
  Deliverable,
  DeliverableStatusCounts,
  Evidence,
  EvidenceWithContext,
  Sponsor,
  SponsorHealth,
  UpcomingDeadline,
} from "./types";

export function statusCounts(deliverables: Deliverable[]): DeliverableStatusCounts {
  return deliverables.reduce<DeliverableStatusCounts>(
    (acc, d) => {
      acc.total += 1;
      if (d.status === "Pending") acc.pending += 1;
      else if (d.status === "At Risk") acc.atRisk += 1;
      else if (d.status === "Delivered") acc.delivered += 1;
      else if (d.status === "Missed") acc.missed += 1;
      return acc;
    },
    { total: 0, pending: 0, atRisk: 0, delivered: 0, missed: 0 }
  );
}

/** Weighted completion: Σ min(delivered, required) / Σ required, as 0-100. */
export function fulfillmentPercent(deliverables: Deliverable[]): number {
  const required = deliverables.reduce((s, d) => s + Math.max(0, d.quantityRequired), 0);
  if (required === 0) return 0;
  const delivered = deliverables.reduce(
    (s, d) => s + Math.min(Math.max(0, d.quantityDelivered), d.quantityRequired),
    0
  );
  return clampPercent((delivered / required) * 100);
}

function healthLevel(
  counts: DeliverableStatusCounts,
  fulfillment: number,
  deliverables: Deliverable[]
): SponsorHealth["health"] {
  const highPriorityMiss = deliverables.some(
    (d) => d.status === "Missed" && d.priority === "High"
  );
  if (highPriorityMiss || counts.missed >= 2 || fulfillment < 65) return "critical";
  if (counts.missed >= 1 || counts.atRisk >= 1 || fulfillment < 90) return "watch";
  return "healthy";
}

export function contractWithStats(db: Database, contract: Contract): ContractWithStats {
  const sponsor =
    db.sponsors.find((s) => s.id === contract.sponsorId) ?? unknownSponsor(contract.sponsorId);
  const team = db.teams.find((t) => t.id === contract.teamId);
  const deliverables = db.deliverables.filter((d) => d.contractId === contract.id);
  return {
    ...contract,
    sponsor,
    teamName: team?.name ?? "—",
    fulfillment: fulfillmentPercent(deliverables),
    counts: statusCounts(deliverables),
  };
}

export function sponsorHealthSummary(db: Database): SponsorHealth[] {
  return db.sponsors
    .map((sponsor) => {
      const deliverables = db.deliverables.filter((d) => d.sponsorId === sponsor.id);
      const contractIds = db.contracts
        .filter((c) => c.sponsorId === sponsor.id)
        .map((c) => c.id);
      const totalValue = db.contracts
        .filter((c) => c.sponsorId === sponsor.id)
        .reduce((s, c) => s + (c.value ?? 0), 0);
      const counts = statusCounts(deliverables);
      const fulfillment = fulfillmentPercent(deliverables);
      return {
        sponsor,
        contractIds,
        fulfillment,
        counts,
        totalValue,
        health: healthLevel(counts, fulfillment, deliverables),
      };
    })
    .sort((a, b) => a.fulfillment - b.fulfillment);
}

export function upcomingDeadlines(db: Database, limit = 6): UpcomingDeadline[] {
  return db.deliverables
    .filter(
      (d) => d.dueDate && d.status !== "Delivered" && d.status !== "Missed"
    )
    .map((d) => ({
      deliverable: d,
      sponsorName: sponsorName(db, d.sponsorId),
      dueInDays: daysUntil(d.dueDate as string),
    }))
    .sort((a, b) => a.dueInDays - b.dueInDays)
    .slice(0, limit);
}

export function enrichEvidence(db: Database, evidence: Evidence): EvidenceWithContext {
  const deliverable = db.deliverables.find((d) => d.id === evidence.deliverableId);
  return {
    ...evidence,
    sponsorName: sponsorName(db, evidence.sponsorId),
    deliverableTitle: deliverable?.title ?? "Unlinked",
  };
}

export function recentEvidence(db: Database, limit = 5): EvidenceWithContext[] {
  return [...db.evidence]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((e) => enrichEvidence(db, e));
}

export function dashboardSummary(db: Database): DashboardSummary {
  const counts = statusCounts(db.deliverables);
  return {
    activeContracts: db.contracts.filter((c) => c.status === "Active").length,
    totalContracts: db.contracts.length,
    totalDeliverables: db.deliverables.length,
    counts,
    overallFulfillment: fulfillmentPercent(db.deliverables),
    totalContractValue: db.contracts.reduce((s, c) => s + (c.value ?? 0), 0),
    upcomingDeadlines: upcomingDeadlines(db),
    sponsorHealth: sponsorHealthSummary(db),
    recentEvidence: recentEvidence(db),
  };
}

function sponsorName(db: Database, sponsorId: string): string {
  return db.sponsors.find((s) => s.id === sponsorId)?.name ?? "Unknown sponsor";
}

function unknownSponsor(id: string): Sponsor {
  return { id, name: "Unknown sponsor", industry: "—" };
}
