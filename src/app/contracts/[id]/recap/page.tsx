"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, Printer, ShieldCheck, Sparkles } from "lucide-react";
import { useAsyncData } from "@/lib/use-async";
import { api } from "@/lib/api-client";
import { formatCompactCurrency, formatDate } from "@/lib/format";
import { Button, Card, Skeleton } from "@/components/ui";
import { CategoryChip, StatusBadge } from "@/components/ui/badges";
import { EvidenceThumb } from "@/components/EvidenceThumb";

export default function RecapPage({ params }: { params: { id: string } }) {
  const { data, loading, error } = useAsyncData(() => api.recap(params.id), params.id);

  if (error) {
    return <Card className="p-6 text-sm text-red-600">Failed to generate recap: {error}</Card>;
  }
  if (loading || !data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  const { report, contract, delivered, openItems, evidence } = data;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Controls (hidden when printing) */}
      <div className="no-print mb-4 flex items-center justify-between">
        <Link
          href={`/contracts/${contract.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to contract
        </Link>
        <Button icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
          Print / Save as PDF
        </Button>
      </div>

      {/* Report */}
      <Card className="print-area overflow-hidden">
        {/* Header band */}
        <div className="bg-gradient-to-br from-brand-700 to-brand-900 px-8 py-7 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-brand-200">
              <ShieldCheck className="h-4 w-4" /> {contract.teamName}
            </div>
            <div className="text-xs text-brand-200">Season {contract.season}</div>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">{contract.sponsor.name}</h1>
          <p className="mt-1 text-brand-100">{report.title}</p>
        </div>

        <div className="space-y-8 px-8 py-7">
          {/* Summary */}
          <section>
            <p className="text-sm leading-relaxed text-ink-700">{report.summary}</p>
          </section>

          {/* Stats */}
          <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatBlock label="Fulfillment" value={`${contract.fulfillment}%`} />
            <StatBlock label="Delivered" value={`${contract.counts.delivered}/${contract.counts.total}`} />
            <StatBlock label="Evidence" value={`${evidence.length}`} />
            <StatBlock label="Value" value={formatCompactCurrency(contract.value)} />
          </section>

          {/* Highlights */}
          <Section title="Highlights" icon={<Sparkles className="h-4 w-4 text-brand-600" />}>
            <ul className="space-y-2">
              {report.highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-ink-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </Section>

          {/* Delivered activations */}
          <Section title="Delivered activations" icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}>
            {delivered.length === 0 ? (
              <p className="text-sm text-ink-500">No fully delivered activations yet this season.</p>
            ) : (
              <div className="divide-y divide-ink-100 rounded-lg border border-ink-100">
                {delivered.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                    <CategoryChip category={d.category} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-800">
                      {d.title}
                    </span>
                    <span className="text-xs tabular-nums text-ink-500">
                      {d.quantityDelivered}/{d.quantityRequired}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Evidence gallery */}
          {evidence.length > 0 ? (
            <Section title="Activation proof">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {evidence.slice(0, 9).map((e) => (
                  <div key={e.id} className="overflow-hidden rounded-lg border border-ink-100">
                    <div className="h-24 w-full bg-ink-50">
                      <EvidenceThumb evidence={e} className="rounded-none" />
                    </div>
                    <div className="px-2.5 py-2">
                      <p className="truncate text-xs font-medium text-ink-800">{e.title}</p>
                      <p className="text-[10px] text-ink-400">{formatDate(e.activationDate)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* In progress / to complete — phrased carefully */}
          {openItems.length > 0 ? (
            <Section title="In progress & to complete" icon={<Clock className="h-4 w-4 text-amber-500" />}>
              <div className="divide-y divide-ink-100 rounded-lg border border-ink-100">
                {openItems.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-700">{d.title}</span>
                    <span className="text-xs tabular-nums text-ink-400">
                      {d.quantityDelivered}/{d.quantityRequired}
                    </span>
                    <StatusBadge status={d.status} />
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Renewal talking points */}
          <Section title="Renewal talking points">
            <ol className="space-y-2">
              {report.renewalTalkingPoints.map((t, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-ink-700">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700">
                    {i + 1}
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
          </Section>

          {/* Footer */}
          <footer className="flex items-center justify-between border-t border-ink-100 pt-4 text-[11px] text-ink-400">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Prepared with PartnerProof
            </span>
            <span>Generated {formatDate(report.createdAt)}</span>
          </footer>
        </div>
      </Card>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink-100 bg-ink-50/50 px-4 py-3">
      <div className="text-2xl font-semibold tracking-tight text-ink-900">{value}</div>
      <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-ink-400">{label}</div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}
