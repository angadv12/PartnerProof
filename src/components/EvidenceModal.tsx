"use client";

import { useEffect, useMemo, useState } from "react";
import { UploadCloud } from "lucide-react";
import { Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { EVIDENCE_TYPES } from "@/lib/constants";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/utils";
import type { EvidenceType, EvidenceWithContext } from "@/lib/types";

interface DeliverableOption {
  id: string;
  title: string;
  sponsorName?: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export function EvidenceModal({
  open,
  onClose,
  deliverables,
  defaultDeliverableId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  deliverables: DeliverableOption[];
  defaultDeliverableId?: string;
  onSaved: (evidence: EvidenceWithContext) => void;
}) {
  const [deliverableId, setDeliverableId] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<EvidenceType>("Image");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [activationDate, setActivationDate] = useState(today());
  const [uploadedBy, setUploadedBy] = useState("Jordan Avery");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDeliverableId(defaultDeliverableId ?? deliverables[0]?.id ?? "");
      setTitle("");
      setType("Image");
      setUrl("");
      setDescription("");
      setActivationDate(today());
      setFile(null);
      setError(null);
    }
  }, [open, defaultDeliverableId, deliverables]);

  const needsFile = type === "Image" || type === "Screenshot" || type === "File";
  const needsUrl = type === "URL";

  const canSave = useMemo(
    () => Boolean(deliverableId && title.trim()),
    [deliverableId, title]
  );

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("deliverableId", deliverableId);
      form.set("title", title.trim());
      form.set("type", type);
      form.set("description", description.trim());
      form.set("activationDate", activationDate);
      form.set("uploadedBy", uploadedBy.trim());
      if (needsUrl && url.trim()) form.set("url", url.trim());
      if (needsFile && file) form.set("file", file);
      const saved = await api.uploadEvidence(form);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Add evidence"
      description="Attach proof of activation to a deliverable."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={!canSave} icon={<UploadCloud className="h-4 w-4" />}>
            Save evidence
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        ) : null}

        <Field label="Linked deliverable" required>
          <Select value={deliverableId} onChange={(e) => setDeliverableId(e.target.value)}>
            {deliverables.length === 0 ? <option value="">No deliverables available</option> : null}
            {deliverables.map((d) => (
              <option key={d.id} value={d.id}>
                {d.sponsorName ? `${d.sponsorName} — ${d.title}` : d.title}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Title" required>
          <Input
            placeholder="e.g. Courtside LED capture vs Coastal"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value as EvidenceType)}>
              {EVIDENCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Activation date">
            <Input
              type="date"
              value={activationDate}
              onChange={(e) => setActivationDate(e.target.value)}
            />
          </Field>
        </div>

        {needsUrl ? (
          <Field label="URL" hint="Link to the post, article, or asset.">
            <Input
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Field>
        ) : null}

        {needsFile ? (
          <Field label="File" hint="Stored locally for this MVP. Optional — metadata is enough.">
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="file:mr-3 file:rounded-md file:border-0 file:bg-ink-100 file:px-3 file:py-1 file:text-xs file:font-medium file:text-ink-700"
            />
          </Field>
        ) : null}

        <Field label="Description">
          <Textarea
            rows={3}
            placeholder="Performance notes, reach, context…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <Field label="Uploaded by">
          <Input value={uploadedBy} onChange={(e) => setUploadedBy(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
