"use client";

import { useMemo, useState } from "react";
import { Camera, CalendarDays, ListChecks, Search, X } from "lucide-react";
import { useAsyncData } from "@/lib/use-async";
import { api } from "@/lib/api-client";
import { CATEGORIES, DELIVERABLE_STATUSES, PRIORITIES, STATUS_STYLES } from "@/lib/constants";
import { relativeDueLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  ProgressBar,
  Select,
  Skeleton,
} from "@/components/ui";
import { CategoryChip, PriorityBadge } from "@/components/ui/badges";
import { DeliverableModal } from "@/components/DeliverableModal";
import { EvidenceModal } from "@/components/EvidenceModal";
import type { Category, Deliverable, DeliverableWithContext, Priority } from "@/lib/types";

export default function DeliverablesPage() {
  const [sponsorId, setSponsorId] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [search, setSearch] = useState("");

  const filters = { sponsorId, category, priority, search };
  const key = JSON.stringify(filters);

  const { data, loading, error, reload } = useAsyncData(
    () =>
      api.deliverables({
        sponsorId: sponsorId || undefined,
        category: (category || undefined) as Category | undefined,
        priority: (priority || undefined) as Priority | undefined,
        search: search || undefined,
      }),
    key
  );
  const sponsors = useAsyncData(() => api.sponsors());

  const [editing, setEditing] = useState<Deliverable | null>(null);
  const [evidenceFor, setEvidenceFor] = useState<string | undefined>(undefined);
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  const columns = useMemo(() => {
    const items = data ?? [];
    return DELIVERABLE_STATUSES.map((status) => ({
      status,
      items: items.filter((d) => d.status === status),
    }));
  }, [data]);

  const hasFilters = Boolean(sponsorId || category || priority || search);
  function clearFilters() {
    setSponsorId("");
    setCategory("");
    setPriority("");
    setSearch("");
  }

  const deliverableOptions = (data ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    sponsorName: d.sponsorName,
  }));

  return (
    <div>
      <PageHeader
        title="Deliverables"
        description="Every sponsor obligation across all contracts, by status."
      />

      {/* Filters */}
      <Card className="mb-5 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              className="input-base pl-9"
              placeholder="Search deliverables…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={sponsorId} onChange={(e) => setSponsorId(e.target.value)} className="w-auto min-w-[130px]">
            <option value="">All sponsors</option>
            {(sponsors.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-auto min-w-[130px]">
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-auto min-w-[120px]">
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
          {hasFilters ? (
            <Button variant="ghost" size="sm" icon={<X className="h-4 w-4" />} onClick={clearFilters}>
              Clear
            </Button>
          ) : null}
        </div>
      </Card>

      {error ? (
        <Card className="p-6 text-sm text-red-600">Failed to load deliverables: {error}</Card>
      ) : loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {columns.map((col) => (
            <div key={col.status} className="flex flex-col">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", STATUS_STYLES[col.status].dot)} />
                  <span className="text-sm font-semibold text-ink-800">{col.status}</span>
                </div>
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-500">
                  {col.items.length}
                </span>
              </div>

              <div
                className={cn(
                  "flex-1 space-y-2.5 rounded-xl border border-dashed p-2.5",
                  col.items.length === 0 ? "border-ink-200" : "border-transparent bg-ink-100/40"
                )}
              >
                {col.items.length === 0 ? (
                  <div className="py-8 text-center text-xs text-ink-400">No items</div>
                ) : (
                  col.items.map((d) => (
                    <DeliverableCard
                      key={d.id}
                      deliverable={d}
                      onEdit={() => setEditing(d)}
                      onAddEvidence={() => {
                        setEvidenceFor(d.id);
                        setEvidenceOpen(true);
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && data && data.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            icon={<ListChecks className="h-5 w-5" />}
            title="No deliverables match"
            description={hasFilters ? "Try clearing filters to see everything." : "Upload a contract to create deliverables."}
            action={hasFilters ? <Button variant="secondary" onClick={clearFilters}>Clear filters</Button> : undefined}
          />
        </Card>
      ) : null}

      <DeliverableModal
        deliverable={editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={() => reload()}
      />
      <EvidenceModal
        open={evidenceOpen}
        onClose={() => setEvidenceOpen(false)}
        deliverables={deliverableOptions}
        defaultDeliverableId={evidenceFor}
        onSaved={() => reload()}
      />
    </div>
  );
}

function DeliverableCard({
  deliverable: d,
  onEdit,
  onAddEvidence,
}: {
  deliverable: DeliverableWithContext;
  onEdit: () => void;
  onAddEvidence: () => void;
}) {
  return (
    <div
      onClick={onEdit}
      className="cursor-pointer rounded-lg border border-ink-200 bg-white p-3 shadow-sm transition hover:border-brand-200 hover:shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug text-ink-900">{d.title}</p>
        <PriorityBadge priority={d.priority} />
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-xs text-ink-500">{d.sponsorName}</span>
        <CategoryChip category={d.category} />
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <ProgressBar
          value={(d.quantityDelivered / Math.max(1, d.quantityRequired)) * 100}
          size="sm"
        />
        <span className="flex-shrink-0 text-xs tabular-nums text-ink-500">
          {d.quantityDelivered}/{d.quantityRequired}
        </span>
      </div>
      <div className="mt-2.5 flex items-center justify-between border-t border-ink-100 pt-2">
        <span className="flex items-center gap-1 text-[11px] text-ink-400">
          {d.dueDate ? (
            <>
              <CalendarDays className="h-3 w-3" />
              {relativeDueLabel(d.dueDate)}
            </>
          ) : (
            "No due date"
          )}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddEvidence();
          }}
          className="focus-ring rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
          title="Add evidence"
        >
          <Camera className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
