"use client";

import { useEffect, useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { CATEGORIES, DELIVERABLE_STATUSES, PRIORITIES } from "@/lib/constants";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/utils";
import type {
  Category,
  Deliverable,
  DeliverableStatus,
  Priority,
  UpdateDeliverableInput,
} from "@/lib/types";

interface FormState {
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  status: DeliverableStatus;
  dueDate: string;
  quantityRequired: number;
  quantityDelivered: number;
  notes: string;
}

function toForm(d: Deliverable): FormState {
  return {
    title: d.title,
    description: d.description,
    category: d.category,
    priority: d.priority,
    status: d.status,
    dueDate: d.dueDate ?? "",
    quantityRequired: d.quantityRequired,
    quantityDelivered: d.quantityDelivered,
    notes: d.notes ?? "",
  };
}

export function DeliverableModal({
  deliverable,
  open,
  onClose,
  onSaved,
}: {
  deliverable: Deliverable | null;
  open: boolean;
  onClose: () => void;
  onSaved: (updated: Deliverable) => void;
}) {
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (deliverable && open) {
      setForm(toForm(deliverable));
      setError(null);
    }
  }, [deliverable, open]);

  if (!deliverable || !form) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const adjustDelivered = (delta: number) =>
    set("quantityDelivered", Math.max(0, Math.min(form.quantityRequired, form.quantityDelivered + delta)));

  async function save(overrides?: Partial<UpdateDeliverableInput>) {
    if (!form || !deliverable) return;
    setSaving(true);
    setError(null);
    try {
      const payload: UpdateDeliverableInput = {
        title: form.title,
        description: form.description,
        category: form.category,
        priority: form.priority,
        status: form.status,
        dueDate: form.dueDate || null,
        quantityRequired: form.quantityRequired,
        quantityDelivered: form.quantityDelivered,
        notes: form.notes,
        ...overrides,
      };
      const updated = await api.updateDeliverable(deliverable.id, payload);
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const pct = Math.round((form.quantityDelivered / Math.max(1, form.quantityRequired)) * 100);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Edit deliverable"
      description={deliverable.title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            icon={<Check className="h-4 w-4" />}
            onClick={() => save({ status: "Delivered", quantityDelivered: form.quantityRequired })}
            disabled={saving}
          >
            Mark delivered
          </Button>
          <Button onClick={() => save()} loading={saving}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        ) : null}

        <Field label="Title">
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
        </Field>

        <Field label="Description">
          <Textarea
            rows={2}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(e) => set("status", e.target.value as DeliverableStatus)}
            >
              {DELIVERABLE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Category">
            <Select
              value={form.category}
              onChange={(e) => set("category", e.target.value as Category)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select
              value={form.priority}
              onChange={(e) => set("priority", e.target.value as Priority)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {/* Quantity tracking */}
        <div className="rounded-xl border border-ink-200 bg-ink-50/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-700">Quantity delivered</span>
            <span className="text-xs text-ink-500">{pct}% complete</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => adjustDelivered(-1)}
                className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
                aria-label="Decrease"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-16 text-center text-lg font-semibold tabular-nums text-ink-900">
                {form.quantityDelivered}
                <span className="text-sm font-normal text-ink-400"> / {form.quantityRequired}</span>
              </span>
              <button
                type="button"
                onClick={() => adjustDelivered(1)}
                className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
                aria-label="Increase"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1" />
            <Field label="Required" className="w-24">
              <Input
                type="number"
                min={1}
                value={form.quantityRequired}
                onChange={(e) => set("quantityRequired", Math.max(1, Number(e.target.value) || 1))}
              />
            </Field>
          </div>
        </div>

        <Field label="Due date">
          <Input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
        </Field>

        <Field label="Notes">
          <Textarea
            rows={2}
            placeholder="Internal notes, context, or next steps…"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>

        {deliverable.sourceText ? (
          <div className="rounded-lg border border-ink-100 bg-white px-3 py-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-ink-400">
              Source clause from contract
            </div>
            <p className="mt-1 text-xs italic text-ink-600">"{deliverable.sourceText}"</p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
