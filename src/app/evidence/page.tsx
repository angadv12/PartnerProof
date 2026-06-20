"use client";

import { useState } from "react";
import { Camera, ExternalLink, Plus } from "lucide-react";
import { useAsyncData } from "@/lib/use-async";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { Button, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { EvidenceThumb } from "@/components/EvidenceThumb";
import { EvidenceModal } from "@/components/EvidenceModal";

export default function EvidencePage() {
  const { data, loading, error, reload } = useAsyncData(() => api.evidence());
  const deliverables = useAsyncData(() => api.deliverables());
  const [open, setOpen] = useState(false);

  const deliverableOptions = (deliverables.data ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    sponsorName: d.sponsorName,
  }));

  return (
    <div>
      <PageHeader
        title="Evidence"
        description="Proof of activation captured across every sponsorship."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
            Add evidence
          </Button>
        }
      />

      {error ? (
        <Card className="p-6 text-sm text-red-600">Failed to load evidence: {error}</Card>
      ) : loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : data && data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Camera className="h-5 w-5" />}
            title="No evidence yet"
            description="Attach screenshots, links, or notes to prove sponsor activations were delivered."
            action={
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
                Add evidence
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(data ?? []).map((e) => (
            <Card key={e.id} className="flex flex-col overflow-hidden">
              <div className="h-32 w-full bg-ink-50 p-px">
                <EvidenceThumb evidence={e} className="rounded-none" />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-snug text-ink-900">{e.title}</p>
                  <span className="flex-shrink-0 rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-500">
                    {e.type}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-ink-500">{e.description}</p>
                <div className="mt-2 text-xs text-ink-500">
                  <span className="font-medium text-ink-700">{e.sponsorName}</span> · {e.deliverableTitle}
                </div>
                {e.url ? (
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Open link
                  </a>
                ) : null}
                <div className="mt-auto flex items-center justify-between pt-3 text-[11px] text-ink-400">
                  <span>{formatDate(e.activationDate)}</span>
                  <span>{e.uploadedBy}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <EvidenceModal
        open={open}
        onClose={() => setOpen(false)}
        deliverables={deliverableOptions}
        onSaved={() => reload()}
      />
    </div>
  );
}
