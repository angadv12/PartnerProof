"use client";

import Link from "next/link";
import { ArrowRight, FileText, Plus } from "lucide-react";
import { useAsyncData } from "@/lib/use-async";
import { api } from "@/lib/api-client";
import { formatCompactCurrency, formatDate } from "@/lib/format";
import {
  Button,
  Card,
  EmptyState,
  Monogram,
  PageHeader,
  ProgressBar,
  Skeleton,
} from "@/components/ui";
import { ContractStatusBadge } from "@/components/ui/badges";

export default function ContractsPage() {
  const { data, loading, error } = useAsyncData(() => api.contracts());

  return (
    <div>
      <PageHeader
        title="Contracts"
        description="Every sponsorship agreement and its live fulfillment status."
        actions={
          <Link href="/contracts/new">
            <Button icon={<Plus className="h-4 w-4" />}>Upload contract</Button>
          </Link>
        }
      />

      {error ? (
        <Card className="p-6 text-sm text-red-600">Failed to load contracts: {error}</Card>
      ) : loading || !data ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title="No contracts yet"
            description="Upload a sponsorship contract and extract its deliverables to get started."
            action={
              <Link href="/contracts/new">
                <Button icon={<Plus className="h-4 w-4" />}>Upload contract</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {data.map((c) => (
            <Link key={c.id} href={`/contracts/${c.id}`} className="group">
              <Card className="flex h-full flex-col p-5 transition hover:border-brand-200 hover:shadow-pop">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Monogram name={c.sponsor.name} size="lg" />
                    <div>
                      <div className="font-semibold text-ink-900">{c.sponsor.name}</div>
                      <div className="text-xs text-ink-500">{c.sponsor.industry}</div>
                    </div>
                  </div>
                  <ContractStatusBadge status={c.status} />
                </div>

                <p className="mt-4 text-sm font-medium text-ink-800">{c.name}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-500">
                  <span>Season {c.season}</span>
                  <span>·</span>
                  <span>{formatCompactCurrency(c.value)}</span>
                  <span>·</span>
                  <span>
                    {formatDate(c.startDate)} – {formatDate(c.endDate)}
                  </span>
                </div>

                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-ink-500">Fulfillment</span>
                    <span className="font-semibold text-ink-700">{c.fulfillment}%</span>
                  </div>
                  <ProgressBar value={c.fulfillment} />
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3">
                  <div className="flex gap-3 text-xs">
                    <CountPill value={c.counts.delivered} label="delivered" tone="emerald" />
                    <CountPill value={c.counts.atRisk} label="at risk" tone="amber" />
                    <CountPill value={c.counts.missed} label="missed" tone="red" />
                  </div>
                  <span className="flex items-center gap-1 text-xs font-medium text-brand-600 opacity-0 transition group-hover:opacity-100">
                    View <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CountPill({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "emerald" | "amber" | "red";
}) {
  const tones = {
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    red: "text-red-600",
  };
  return (
    <span className="flex items-baseline gap-1">
      <span className={`font-semibold ${value === 0 ? "text-ink-300" : tones[tone]}`}>{value}</span>
      <span className="text-ink-400">{label}</span>
    </span>
  );
}
