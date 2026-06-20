/**
 * Shared enumeration values and their UI presentation metadata.
 * Centralizing colors/labels here keeps badges, filters and charts consistent.
 */
import type {
  Category,
  ContractStatus,
  DeliverableStatus,
  EvidenceType,
  Priority,
} from "./types";

export const CATEGORIES: Category[] = [
  "Social",
  "Digital",
  "Broadcast",
  "In-arena",
  "Hospitality",
  "Email",
  "Content",
  "Other",
];

export const DELIVERABLE_STATUSES: DeliverableStatus[] = [
  "Pending",
  "At Risk",
  "Delivered",
  "Missed",
];

export const PRIORITIES: Priority[] = ["Low", "Medium", "High"];

export const CONTRACT_STATUSES: ContractStatus[] = [
  "Draft",
  "Active",
  "Completed",
  "Expired",
];

export const EVIDENCE_TYPES: EvidenceType[] = [
  "Image",
  "Screenshot",
  "URL",
  "Text Note",
  "File",
];

/** Tailwind class bundles for each deliverable status badge. */
export const STATUS_STYLES: Record<
  DeliverableStatus,
  { badge: string; dot: string; column: string }
> = {
  Pending: {
    badge: "bg-ink-100 text-ink-700 ring-1 ring-inset ring-ink-200",
    dot: "bg-ink-400",
    column: "border-ink-200",
  },
  "At Risk": {
    badge: "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200",
    dot: "bg-amber-500",
    column: "border-amber-300",
  },
  Delivered: {
    badge: "bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200",
    dot: "bg-emerald-500",
    column: "border-emerald-300",
  },
  Missed: {
    badge: "bg-red-100 text-red-700 ring-1 ring-inset ring-red-200",
    dot: "bg-red-500",
    column: "border-red-300",
  },
};

export const PRIORITY_STYLES: Record<Priority, string> = {
  Low: "bg-ink-100 text-ink-600 ring-1 ring-inset ring-ink-200",
  Medium: "bg-sky-100 text-sky-700 ring-1 ring-inset ring-sky-200",
  High: "bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-200",
};

export const CONTRACT_STATUS_STYLES: Record<ContractStatus, string> = {
  Draft: "bg-ink-100 text-ink-700 ring-1 ring-inset ring-ink-200",
  Active: "bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200",
  Completed: "bg-brand-100 text-brand-700 ring-1 ring-inset ring-brand-200",
  Expired: "bg-ink-100 text-ink-500 ring-1 ring-inset ring-ink-200",
};

/** Subtle accent chip per category, used on deliverable cards & filters. */
export const CATEGORY_STYLES: Record<Category, string> = {
  Social: "bg-fuchsia-100 text-fuchsia-700",
  Digital: "bg-brand-100 text-brand-700",
  Broadcast: "bg-violet-100 text-violet-700",
  "In-arena": "bg-orange-100 text-orange-700",
  Hospitality: "bg-teal-100 text-teal-700",
  Email: "bg-cyan-100 text-cyan-700",
  Content: "bg-indigo-100 text-indigo-700",
  Other: "bg-ink-100 text-ink-700",
};

export const SPONSOR_HEALTH_STYLES: Record<
  SponsorHealthLevel,
  { label: string; badge: string; bar: string }
> = {
  healthy: {
    label: "Healthy",
    badge: "bg-emerald-100 text-emerald-800",
    bar: "bg-emerald-500",
  },
  watch: {
    label: "Watch",
    badge: "bg-amber-100 text-amber-800",
    bar: "bg-amber-500",
  },
  critical: {
    label: "Critical",
    badge: "bg-red-100 text-red-700",
    bar: "bg-red-500",
  },
};

export type SponsorHealthLevel = "healthy" | "watch" | "critical";

/** The team currently "logged in" for this single-tenant MVP. */
export const ACTIVE_TEAM_ID = "team-breakers";
