import { cn } from "@/lib/utils";
import {
  CATEGORY_STYLES,
  CONTRACT_STATUS_STYLES,
  PRIORITY_STYLES,
  SPONSOR_HEALTH_STYLES,
  STATUS_STYLES,
  type SponsorHealthLevel,
} from "@/lib/constants";
import type {
  Category,
  ContractStatus,
  DeliverableStatus,
  Priority,
} from "@/lib/types";

const PILL = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium";

export function StatusBadge({ status }: { status: DeliverableStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={cn(PILL, s.badge)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={cn(PILL, PRIORITY_STYLES[priority])}>{priority}</span>;
}

export function CategoryChip({ category }: { category: Category }) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", CATEGORY_STYLES[category])}>
      {category}
    </span>
  );
}

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return <span className={cn(PILL, CONTRACT_STATUS_STYLES[status])}>{status}</span>;
}

export function HealthBadge({ level }: { level: SponsorHealthLevel }) {
  const s = SPONSOR_HEALTH_STYLES[level];
  return <span className={cn(PILL, s.badge)}>{s.label}</span>;
}
