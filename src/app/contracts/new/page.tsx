"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Sparkles, Trash2, Plus, Wand2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { CATEGORIES, PRIORITIES } from "@/lib/constants";
import { errorMessage } from "@/lib/utils";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import type { Category, ExtractedDeliverable, Priority } from "@/lib/types";

const SAMPLE_CONTRACT = `Pepsi will receive presenting partner status for the 2026 home season. The Team will provide Pepsi logo placement on the team homepage for a minimum of 30 consecutive days. The Team will publish five sponsored Instagram posts during the regular season. Pepsi will receive LED board exposure during ten home games. Pepsi will receive one halftime fan activation before the end of the regular season. The Team will include Pepsi in one email campaign to season ticket holders. The Team will provide a post-season recap report with screenshots, performance notes, and activation proof.`;

export default function NewContractPage() {
  const router = useRouter();

  const [sponsorName, setSponsorName] = useState("");
  const [season, setSeason] = useState("2025-26");
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [text, setText] = useState("");

  const [extracted, setExtracted] = useState<ExtractedDeliverable[] | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileNote, setFileNote] = useState<string | null>(null);

  function loadSample() {
    setText(SAMPLE_CONTRACT);
    if (!sponsorName) setSponsorName("Pepsi");
    if (!name) setName("Pepsi Presenting Partnership");
    setFileNote(null);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      setFileNote(
        `"${file.name}" attached. PDF text extraction is stubbed in this MVP — paste the contract text below or load the sample.`
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result ?? ""));
      setFileNote(`Loaded text from "${file.name}".`);
    };
    reader.readAsText(file);
  }

  async function extract() {
    if (!text.trim()) {
      setError("Paste contract text (or load the sample) before extracting.");
      return;
    }
    setExtracting(true);
    setError(null);
    try {
      const result = await api.extract(text, { sponsorName, season });
      setExtracted(result);
      if (result.length === 0) {
        setError("No deliverables detected. Try the sample contract or add rows manually.");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setExtracting(false);
    }
  }

  function updateRow(index: number, patch: Partial<ExtractedDeliverable>) {
    setExtracted((rows) => rows?.map((r, i) => (i === index ? { ...r, ...patch } : r)) ?? rows);
  }

  function removeRow(index: number) {
    setExtracted((rows) => rows?.filter((_, i) => i !== index) ?? rows);
  }

  function addRow() {
    const blank: ExtractedDeliverable = {
      title: "",
      description: "",
      category: "Other",
      quantityRequired: 1,
      priority: "Medium",
      sourceText: "",
    };
    setExtracted((rows) => [...(rows ?? []), blank]);
  }

  async function save() {
    if (!sponsorName.trim() || !season.trim() || !name.trim()) {
      setError("Sponsor name, season, and contract name are required.");
      return;
    }
    const deliverables = (extracted ?? []).filter((d) => d.title.trim());
    if (deliverables.length === 0) {
      setError("Add at least one deliverable before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await api.createContract({
        sponsorName,
        name,
        season,
        value: value ? Number(value) : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        rawText: text || undefined,
        deliverables,
      });
      router.push(`/contracts/${created.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/contracts"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-700"
      >
        <ArrowLeft className="h-4 w-4" /> Contracts
      </Link>

      <PageHeader
        title="Upload contract"
        description="Add a sponsorship agreement, extract its deliverables, then review and save."
      />

      {error ? (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="space-y-5">
        {/* Step 1: details */}
        <Card>
          <CardHeader title="1 · Contract details" description="Who and when" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Sponsor name" required>
              <Input
                placeholder="e.g. Pepsi"
                value={sponsorName}
                onChange={(e) => setSponsorName(e.target.value)}
              />
            </Field>
            <Field label="Contract name" required>
              <Input
                placeholder="e.g. Presenting Partnership"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Season" required>
              <Input value={season} onChange={(e) => setSeason(e.target.value)} />
            </Field>
            <Field label="Contract value (USD)">
              <Input
                type="number"
                placeholder="1200000"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </Field>
            <Field label="Start date">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="End date">
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>
        </Card>

        {/* Step 2: contract text */}
        <Card>
          <CardHeader
            title="2 · Contract text"
            description="Paste the contract language, upload a .txt, or load the sample"
            action={
              <Button size="sm" variant="ghost" icon={<Wand2 className="h-4 w-4" />} onClick={loadSample}>
                Load sample
              </Button>
            }
          />
          <div className="space-y-3 p-5">
            <Textarea
              rows={7}
              placeholder="Paste sponsorship contract text here…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className="cursor-pointer text-xs text-ink-500">
                <input type="file" accept=".txt,.pdf" onChange={onFile} className="hidden" />
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 hover:bg-ink-50">
                  <FileText className="h-3.5 w-3.5" /> Upload file
                </span>
              </label>
              {fileNote ? <span className="text-xs text-ink-500">{fileNote}</span> : null}
              <div className="flex-1" />
              <Button
                icon={<Sparkles className="h-4 w-4" />}
                loading={extracting}
                onClick={extract}
              >
                Extract deliverables
              </Button>
            </div>
          </div>
        </Card>

        {/* Step 3: review */}
        {extracted !== null ? (
          <Card>
            <CardHeader
              title="3 · Review deliverables"
              description={`${extracted.length} detected — edit, remove, or add before saving`}
              action={
                <Button size="sm" variant="ghost" icon={<Plus className="h-4 w-4" />} onClick={addRow}>
                  Add row
                </Button>
              }
            />
            {extracted.length === 0 ? (
              <EmptyState
                icon={<Sparkles className="h-5 w-5" />}
                title="No deliverables detected"
                description="Add deliverables manually, or load the sample contract and re-extract."
                action={
                  <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={addRow}>
                    Add deliverable
                  </Button>
                }
              />
            ) : (
              <div className="divide-y divide-ink-100">
                {extracted.map((row, i) => (
                  <div key={i} className="grid grid-cols-12 items-start gap-2 px-5 py-3">
                    <div className="col-span-12 sm:col-span-5">
                      <Input
                        value={row.title}
                        placeholder="Deliverable title"
                        onChange={(e) => updateRow(i, { title: e.target.value })}
                      />
                      {row.sourceText ? (
                        <p className="mt-1 line-clamp-1 text-[11px] italic text-ink-400" title={row.sourceText}>
                          “{row.sourceText}”
                        </p>
                      ) : null}
                    </div>
                    <div className="col-span-5 sm:col-span-3">
                      <Select
                        value={row.category}
                        onChange={(e) => updateRow(i, { category: e.target.value as Category })}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <Input
                        type="number"
                        min={1}
                        value={row.quantityRequired}
                        onChange={(e) =>
                          updateRow(i, { quantityRequired: Math.max(1, Number(e.target.value) || 1) })
                        }
                      />
                      {row.unit ? (
                        <p className="mt-1 text-center text-[11px] text-ink-400">{row.unit}</p>
                      ) : null}
                    </div>
                    <div className="col-span-3 sm:col-span-1">
                      <Select
                        value={row.priority}
                        onChange={(e) => updateRow(i, { priority: e.target.value as Priority })}
                      >
                        {PRIORITIES.map((p) => (
                          <option key={p} value={p}>
                            {p[0]}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="col-span-1 flex justify-end pt-2">
                      <button
                        onClick={() => removeRow(i)}
                        className="focus-ring rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-500"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between gap-3 border-t border-ink-100 bg-ink-50/60 px-5 py-3">
              <p className="text-xs text-ink-500">
                Saved deliverables start as <b>Pending</b> — track them on the board afterward.
              </p>
              <Button onClick={save} loading={saving}>
                Save contract
              </Button>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
