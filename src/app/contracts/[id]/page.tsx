"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Camera,
  FileBarChart2,
  Pencil,
  Plus,
} from "lucide-react";
import { useAsyncData } from "@/lib/use-async";
import { api } from "@/lib/api-client";
import { CATEGORIES } from "@/lib/constants";
import { formatCompactCurrency, formatDate, relativeDueLabel } from "@/lib/format";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Monogram,
  PageHeader,
  ProgressBar,
  Skeleton,
} from "@/components/ui";
import {
  CategoryChip,
  ContractStatusBadge,
  PriorityBadge,
  StatusBadge,
} from "@/components/ui/badges";
import { DeliverableModal } from "@/components/DeliverableModal";
import { EvidenceModal } from "@/components/EvidenceModal";
import { EvidenceThumb } from "@/components/EvidenceThumb";
import type { Deliverable } from "@/lib/types";

export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error, reload } = useAsyncData(() => api.contract(id), id);

  const [editing, setEditing] = useState<Deliverable | null>(null);
  const [evidenceFor, setEvidenceFor] = useState<string | undefined>(undefined);
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  function openEvidence(deliverableId?: string) {
    setEvidenceFor(deliverableId);
    setEvidenceOpen(true);
  }

  if (error) {
    return <Card className="p-6 text-sm text-red-600">Failed to load contract: {error}</Card>;
  }
  if (loading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!data) {
    return (
      <Card>
        <EmptyState title="Contract not found" description="This contract may have been removed." />
      </Card>
    );
  }

  const attention = data.deliverables.filter(
    (d) => d.status === "At Risk" || d.status === "Missed"
  );
  const groups = CATEGORIES.map((category) => ({
    category,
    items: data.deliverables.filter((d) => d.category === category),
  })).filter((g) => g.items.length > 0);

  const deliverableOptions = data.deliverables.map((d) => ({
    id: d.id,
    title: d.title,
    sponsorName: data.sponsor.name,
  }));

  return (
    <div>
      <Link
        href="/contracts"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-700"
      >
        <ArrowLeft className="h-4 w-4" /> Contracts
      </Link>

      <PageHeader
        title={data.sponsor.name}
        description={data.name}
        actions={
          <>
            <Button variant="secondary" icon={<Camera className="h-4 w-4" />} onClick={() => openEvidence()}>
              Add evidence
            </Button>
            <Link href={`/contracts/${data.id}/recap`}>
              <Button icon={<FileBarChart2 className="h-4 w-4" />}>Recap report</Button>
            </Link>
          </>
        }
      />

      {/* Overview */}
      <Card className="p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Monogram name={data.sponsor.name} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink-900">{data.sponsor.name}</span>
                <ContractStatusBadge status={data.status} />
              </div>
              <div className="text-sm text-ink-500">{data.sponsor.industry}</div>
              {data.sponsor.primaryContact ? (
                <div className="mt-0.5 text-xs text-ink-400">{data.sponsor.primaryContact}</div>
              ) : null}
            </div>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 lg:max-w-2xl">
            <Fact label="Season" value={data.season} />
            <Fact label="Value" value={formatCompactCurrency(data.value)} />
            <Fact label="Start" value={formatDate(data.startDate)} />
            <Fact label="End" value={formatDate(data.endDate)} />
          </div>
        </div>

        <div className="mt-5 border-t border-ink-100 pt-4">
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="font-medium text-ink-700">Overall fulfillment</span>
            <span className="font-semibold text-ink-900">{data.fulfillment}%</span>
          </div>
          <ProgressBar value={data.fulfillment} />
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-500">
            <span><b className="text-emerald-600">{data.counts.delivered}</b> delivered</span>
            <span><b className="text-amber-600">{data.counts.atRisk}</b> at risk</span>
            <span><b className="text-red-600">{data.counts.missed}</b> missed</span>
            <span><b className="text-ink-700">{data.counts.pending}</b> pending</span>
          </div>
        </div>
      </Card>

      {/* Needs attention */}
      {attention.length > 0 ? (
        <Card className="mt-6 border-amber-200 bg-amber-50/40">
          <CardHeader
            title={
              <span className="flex items-center gap-2 text-amber-800">
                <AlertTriangle className="h-4 w-4" /> Needs attention ({attention.length})
              </span>
            }
            description="At-risk and missed obligations to resolve before renewal"
            className="border-amber-100"
          />
          <ul className="divide-y divide-amber-100">
            {attention.map((d) => (
              <li key={d.id}>
                <button
                  onClick={() => setEditing(d)}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-amber-50"
                >
                  <StatusBadge status={d.status} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-800">
                    {d.title}
                  </span>
                  <span className="hidden text-xs text-ink-500 sm:block">
                    {relativeDueLabel(d.dueDate)}
                  </span>
                  <span className="text-xs tabular-nums text-ink-500">
                    {d.quantityDelivered}/{d.quantityRequired}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* Deliverables grouped by category */}
      <div className="mt-6 space-y-5">
        {groups.map((group) => (
          <Card key={group.category}>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <CategoryChip category={group.category} />
                  <span className="text-ink-400">{group.items.length}</span>
                </span>
              }
            />
            <ul className="divide-y divide-ink-100">
              {group.items.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-5 py-3.5">
                  <button onClick={() => setEditing(d)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-ink-900">{d.title}</span>
                      <PriorityBadge priority={d.priority} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-ink-500">{d.description}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <ProgressBar value={(d.quantityDelivered / Math.max(1, d.quantityRequired)) * 100} size="sm" className="max-w-[160px]" />
                      <span className="text-xs tabular-nums text-ink-500">
                        {d.quantityDelivered}/{d.quantityRequired}
                      </span>
                      {d.dueDate ? (
                        <span className="hidden items-center gap-1 text-xs text-ink-400 sm:flex">
                          <CalendarDays className="h-3 w-3" /> {relativeDueLabel(d.dueDate)}
                        </span>
                      ) : null}
                    </div>
                  </button>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <StatusBadge status={d.status} />
                    <button
                      onClick={() => openEvidence(d.id)}
                      className="focus-ring rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
                      title="Add evidence"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setEditing(d)}
                      className="focus-ring rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      {/* Evidence timeline */}
      <Card className="mt-6">
        <CardHeader
          title="Evidence timeline"
          description={`${data.evidence.length} activation proof item${data.evidence.length === 1 ? "" : "s"}`}
          action={
            <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => openEvidence()}>
              Add
            </Button>
          }
        />
        {data.evidence.length === 0 ? (
          <EmptyState
            icon={<Camera className="h-5 w-5" />}
            title="No evidence captured yet"
            description="Attach screenshots, links, or notes to prove activations were delivered."
            action={
              <Button variant="secondary" onClick={() => openEvidence()}>
                Add evidence
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {data.evidence.map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-5 py-3.5">
                <div className="h-12 w-12 flex-shrink-0">
                  <EvidenceThumb evidence={e} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink-900">{e.title}</span>
                    <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-500">
                      {e.type}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{e.description}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-400">
                    <span>{e.deliverableTitle}</span>
                    {e.url ? (
                      <>
                        <span>·</span>
                        <a href={e.url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                          Open link
                        </a>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right text-xs text-ink-400">
                  <div>{formatDate(e.activationDate)}</div>
                  <div className="mt-0.5">{e.uploadedBy}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink-400">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-ink-900">{value}</div>
    </div>
  );
}
