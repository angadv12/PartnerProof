"use client";

import Link from "next/link";
import { ArrowRight, FileBarChart2 } from "lucide-react";
import { useAsyncData } from "@/lib/use-async";
import { api } from "@/lib/api-client";
import { formatCompactCurrency } from "@/lib/format";
import {
  Card,
  EmptyState,
  Monogram,
  PageHeader,
  ProgressBar,
  Skeleton,
} from "@/components/ui";

export default function RecapsPage() {
  const { data, loading, error } = useAsyncData(() => api.contracts());

  return (
    <div>
      <PageHeader
        title="Recap Reports"
        description="Generate a sponsor-ready recap of delivered activations for any contract."
      />

      {error ? (
        <Card className="p-6 text-sm text-red-600">Failed to load contracts: {error}</Card>
      ) : loading || !data ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileBarChart2 className="h-5 w-5" />}
            title="No contracts to recap"
            description="Upload a contract first, then generate a sponsor recap report."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {data.map((c) => (
            <Link key={c.id} href={`/contracts/${c.id}/recap`} className="group block">
              <Card className="flex items-center gap-4 p-4 transition hover:border-brand-200 hover:shadow-pop">
                <Monogram name={c.sponsor.name} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-ink-900">{c.sponsor.name}</div>
                  <div className="text-xs text-ink-500">
                    {c.name} · Season {c.season} · {formatCompactCurrency(c.value)}
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <ProgressBar value={c.fulfillment} size="sm" className="max-w-[260px]" />
                    <span className="text-xs font-medium text-ink-500">{c.fulfillment}% fulfilled</span>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 transition group-hover:bg-brand-100">
                  <FileBarChart2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Open recap</span>
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
