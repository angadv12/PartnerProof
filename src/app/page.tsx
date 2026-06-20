"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FileText,
  ListChecks,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useAsyncData } from "@/lib/use-async";
import { api } from "@/lib/api-client";
import { formatCompactCurrency, formatDate, relativeDueLabel } from "@/lib/format";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  MetricCard,
  PageHeader,
  ProgressBar,
  Monogram,
  Skeleton,
} from "@/components/ui";
import { HealthBadge } from "@/components/ui/badges";
import { EvidenceThumb } from "@/components/EvidenceThumb";

export default function DashboardPage() {
  const { data, loading, error } = useAsyncData(() => api.dashboard());

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Sponsorship fulfillment across all active partnerships this season."
      />

      {error ? (
        <Card className="p-6 text-sm text-red-600">Failed to load dashboard: {error}</Card>
      ) : loading || !data ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-6">
          {/* Top metrics */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            <MetricCard
              label="Active contracts"
              value={data.activeContracts}
              sublabel={`${data.totalContracts} total`}
              icon={<FileText className="h-4 w-4" />}
            />
            <MetricCard
              label="Deliverables"
              value={data.totalDeliverables}
              sublabel="tracked obligations"
              icon={<ListChecks className="h-4 w-4" />}
              accent="ink"
            />
            <MetricCard
              label="Delivered"
              value={data.counts.delivered}
              sublabel={`${data.overallFulfillment}% fulfillment`}
              icon={<CheckCircle2 className="h-4 w-4" />}
              accent="emerald"
            />
            <MetricCard
              label="At risk"
              value={data.counts.atRisk}
              sublabel="need attention"
              icon={<AlertTriangle className="h-4 w-4" />}
              accent="amber"
            />
            <MetricCard
              label="Missed"
              value={data.counts.missed}
              sublabel="require make-good"
              icon={<XCircle className="h-4 w-4" />}
              accent="red"
            />
          </div>

          {/* Sponsor health + deadlines */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Sponsor health"
                description="Fulfillment and risk by partner"
                action={
                  <Link href="/contracts" className="text-xs font-medium text-brand-600 hover:text-brand-700">
                    View all
                  </Link>
                }
              />
              <div className="divide-y divide-ink-100">
                {data.sponsorHealth.map((s) => {
                  const href = s.contractIds[0] ? `/contracts/${s.contractIds[0]}` : "/contracts";
                  return (
                    <Link
                      key={s.sponsor.id}
                      href={href}
                      className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-ink-50/60"
                    >
                      <Monogram name={s.sponsor.name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-ink-900">
                            {s.sponsor.name}
                          </span>
                          <HealthBadge level={s.health} />
                        </div>
                        <div className="mt-1.5 flex items-center gap-3">
                          <ProgressBar value={s.fulfillment} size="sm" className="max-w-[220px]" />
                          <span className="text-xs font-medium tabular-nums text-ink-500">
                            {s.fulfillment}%
                          </span>
                        </div>
                      </div>
                      <div className="hidden flex-shrink-0 gap-4 text-right text-xs text-ink-500 sm:flex">
                        <Stat value={s.counts.delivered} label="Done" />
                        <Stat value={s.counts.atRisk} label="At risk" tone="amber" />
                        <Stat value={s.counts.missed} label="Missed" tone="red" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </Card>

            <Card>
              <CardHeader title="Upcoming deadlines" description="Next obligations due" />
              {data.upcomingDeadlines.length === 0 ? (
                <EmptyState
                  icon={<CalendarClock className="h-5 w-5" />}
                  title="Nothing due soon"
                  description="All in-flight obligations are scheduled further out."
                />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {data.upcomingDeadlines.map(({ deliverable, sponsorName, dueInDays }) => (
                    <li key={deliverable.id}>
                      <Link
                        href={`/contracts/${deliverable.contractId}`}
                        className="flex items-start gap-3 px-5 py-3 transition hover:bg-ink-50/60"
                      >
                        <CalendarClock
                          className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                            dueInDays < 0 ? "text-red-500" : dueInDays <= 7 ? "text-amber-500" : "text-ink-400"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink-900">
                            {deliverable.title}
                          </p>
                          <p className="text-xs text-ink-500">{sponsorName}</p>
                        </div>
                        <span
                          className={`flex-shrink-0 text-xs font-medium ${
                            dueInDays < 0 ? "text-red-600" : dueInDays <= 7 ? "text-amber-600" : "text-ink-500"
                          }`}
                        >
                          {relativeDueLabel(deliverable.dueDate)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Recent evidence + portfolio */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Recent evidence"
                description="Latest activation proof captured"
                action={
                  <Link href="/evidence" className="text-xs font-medium text-brand-600 hover:text-brand-700">
                    View all
                  </Link>
                }
              />
              {data.recentEvidence.length === 0 ? (
                <EmptyState title="No evidence yet" description="Captured activation proof will appear here." />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {data.recentEvidence.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="h-10 w-10 flex-shrink-0">
                        <EvidenceThumb evidence={e} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-900">{e.title}</p>
                        <p className="truncate text-xs text-ink-500">
                          {e.sponsorName} · {e.deliverableTitle}
                        </p>
                      </div>
                      <span className="flex-shrink-0 text-xs text-ink-400">
                        {formatDate(e.activationDate)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="flex flex-col p-5">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-500">
                <TrendingUp className="h-4 w-4" /> Portfolio
              </div>
              <div className="mt-4">
                <div className="text-4xl font-semibold tracking-tight text-ink-900">
                  {data.overallFulfillment}%
                </div>
                <div className="mt-1 text-xs text-ink-500">overall fulfillment</div>
                <ProgressBar value={data.overallFulfillment} className="mt-3" />
              </div>
              <div className="mt-5 border-t border-ink-100 pt-4">
                <div className="text-2xl font-semibold text-ink-900">
                  {formatCompactCurrency(data.totalContractValue)}
                </div>
                <div className="mt-1 text-xs text-ink-500">activated partnership value</div>
              </div>
              <div className="mt-auto pt-5">
                <Link href="/recaps">
                  <Button variant="secondary" className="w-full">
                    Generate recap reports
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: "amber" | "red" }) {
  return (
    <div className="w-12">
      <div
        className={`text-sm font-semibold tabular-nums ${
          value === 0 ? "text-ink-300" : tone === "amber" ? "text-amber-600" : tone === "red" ? "text-red-600" : "text-ink-900"
        }`}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-ink-400">{label}</div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
