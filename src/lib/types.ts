/**
 * Core domain types for PartnerProof.
 *
 * These interfaces are the single source of truth for the shape of data flowing
 * through the API, the data store, and the UI. They intentionally mirror the
 * "Suggested data model" in the product brief so the model is easy to reason about.
 */

// ---------------------------------------------------------------------------
// Enumerations (string unions + value arrays for iteration in the UI)
// ---------------------------------------------------------------------------

export type Category =
  | "Social"
  | "Digital"
  | "Broadcast"
  | "In-arena"
  | "Hospitality"
  | "Email"
  | "Content"
  | "Other";

export type DeliverableStatus = "Pending" | "At Risk" | "Delivered" | "Missed";

export type Priority = "Low" | "Medium" | "High";

export type ContractStatus = "Draft" | "Active" | "Completed" | "Expired";

export type EvidenceType = "Image" | "Screenshot" | "URL" | "Text Note" | "File";

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export interface Team {
  id: string;
  name: string;
  league: string;
  createdAt: string;
}

export interface Sponsor {
  id: string;
  name: string;
  industry: string;
  logoUrl?: string;
  primaryContact?: string;
}

export interface Contract {
  id: string;
  teamId: string;
  sponsorId: string;
  name: string;
  season: string;
  startDate: string;
  endDate: string;
  value?: number;
  status: ContractStatus;
  rawText?: string;
  createdAt: string;
}

export interface Deliverable {
  id: string;
  contractId: string;
  sponsorId: string;
  title: string;
  description: string;
  category: Category;
  dueDate?: string;
  quantityRequired: number;
  quantityDelivered: number;
  status: DeliverableStatus;
  priority: Priority;
  sourceText?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Evidence {
  id: string;
  deliverableId: string;
  contractId: string;
  sponsorId: string;
  title: string;
  type: EvidenceType;
  url?: string;
  filePath?: string;
  description: string;
  activationDate: string;
  uploadedBy: string;
  createdAt: string;
}

export interface RecapReport {
  id: string;
  contractId: string;
  title: string;
  summary: string;
  highlights: string[];
  renewalTalkingPoints: string[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// The persisted database shape
// ---------------------------------------------------------------------------

export interface Database {
  teams: Team[];
  sponsors: Sponsor[];
  contracts: Contract[];
  deliverables: Deliverable[];
  evidence: Evidence[];
  recapReports: RecapReport[];
}

// ---------------------------------------------------------------------------
// Derived / aggregate view-models (computed, never persisted)
// ---------------------------------------------------------------------------

export interface DeliverableStatusCounts {
  total: number;
  pending: number;
  atRisk: number;
  delivered: number;
  missed: number;
}

/** A contract enriched with its sponsor and roll-up fulfillment stats. */
export interface ContractWithStats extends Contract {
  sponsor: Sponsor;
  teamName: string;
  fulfillment: number; // 0-100
  counts: DeliverableStatusCounts;
}

export interface SponsorHealth {
  sponsor: Sponsor;
  contractIds: string[];
  fulfillment: number; // 0-100
  counts: DeliverableStatusCounts;
  health: "healthy" | "watch" | "critical";
  totalValue: number;
}

export interface UpcomingDeadline {
  deliverable: Deliverable;
  sponsorName: string;
  dueInDays: number;
}

export interface DashboardSummary {
  activeContracts: number;
  totalContracts: number;
  totalDeliverables: number;
  counts: DeliverableStatusCounts;
  overallFulfillment: number;
  totalContractValue: number;
  upcomingDeadlines: UpcomingDeadline[];
  sponsorHealth: SponsorHealth[];
  recentEvidence: EvidenceWithContext[];
}

export interface EvidenceWithContext extends Evidence {
  sponsorName: string;
  deliverableTitle: string;
}

export interface DeliverableWithContext extends Deliverable {
  sponsorName: string;
  contractName: string;
}

/** A contract plus everything the detail page renders. */
export interface ContractDetail extends ContractWithStats {
  deliverables: Deliverable[];
  evidence: EvidenceWithContext[];
}

/** Everything the recap report page renders for a contract. */
export interface RecapView {
  report: RecapReport;
  contract: ContractWithStats;
  delivered: Deliverable[];
  openItems: Deliverable[];
  evidence: EvidenceWithContext[];
}

// ---------------------------------------------------------------------------
// AI extraction & assistant contracts
// ---------------------------------------------------------------------------

/** A deliverable proposed by the extractor, before the user reviews & saves it. */
export interface ExtractedDeliverable {
  title: string;
  description: string;
  category: Category;
  quantityRequired: number;
  unit?: string;
  priority: Priority;
  sourceText: string;
  dueDate?: string;
}

export interface ExtractionContext {
  sponsorName?: string;
  season?: string;
}

export type AssistantAnswerKind = "deliverables" | "evidence" | "summary" | "help";

export interface AssistantResponse {
  answer: string;
  kind: AssistantAnswerKind;
  /** Optional structured payload the UI can render as cards/tables. */
  deliverables?: Deliverable[];
  evidence?: Evidence[];
  /** Free-form facts (label/value) for the "summary" kind. */
  facts?: { label: string; value: string }[];
  /** Example follow-up prompts to suggest in the UI. */
  suggestions?: string[];
}

// ---------------------------------------------------------------------------
// Request payloads (API input contracts)
// ---------------------------------------------------------------------------

export interface CreateContractInput {
  sponsorName: string;
  sponsorIndustry?: string;
  name: string;
  season: string;
  startDate?: string;
  endDate?: string;
  value?: number;
  rawText?: string;
  deliverables: ExtractedDeliverable[];
}

export interface UpdateDeliverableInput {
  title?: string;
  description?: string;
  category?: Category;
  dueDate?: string | null;
  quantityRequired?: number;
  quantityDelivered?: number;
  status?: DeliverableStatus;
  priority?: Priority;
  notes?: string;
}

export interface UploadEvidenceInput {
  deliverableId: string;
  title: string;
  type: EvidenceType;
  url?: string;
  description: string;
  activationDate: string;
  uploadedBy: string;
  /** Original filename, when a file was attached. */
  fileName?: string;
  /** Raw bytes of an uploaded file (server-side only). */
  fileBuffer?: Buffer;
}

export interface DeliverableFilters {
  status?: DeliverableStatus;
  category?: Category;
  sponsorId?: string;
  contractId?: string;
  priority?: Priority;
  search?: string;
}
