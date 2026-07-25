"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleSlash,
  Paperclip,
  Play,
  Wrench,
  X,
} from "lucide-react";

import { errorMessage } from "@/lib/utils";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  PageHeader,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui";
import type {
  AgentRun,
  ProviderId,
  ProviderInfo,
  RunAttachment,
  RunEvent,
  RunStatus,
} from "@/lib/agents/types";

interface WorkflowSummary {
  id: string;
  label: string;
  description: string;
  samplePrompt: string;
  expectsAttachment: boolean;
  toolNames: string[];
  maxSteps: number;
}

interface Capabilities {
  providers: ProviderInfo[];
  workflows: WorkflowSummary[];
  defaultWorkflowId: string;
}

const STATUS_STYLES: Record<RunStatus, string> = {
  running: "bg-brand-50 text-brand-700 border-brand-200",
  succeeded: "bg-emerald-50 text-emerald-700 border-emerald-200",
  incomplete: "bg-amber-50 text-amber-700 border-amber-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  cancelled: "bg-ink-100 text-ink-600 border-ink-200",
};

function StatusPill({ status }: { status: RunStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

/** One line in the live activity log. */
function EventRow({ event }: { event: RunEvent }) {
  switch (event.type) {
    case "tool.called":
      return (
        <div className="flex items-start gap-2 text-xs text-ink-600">
          <Wrench className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-brand-500" />
          <span>
            <span className="font-medium text-ink-800">{event.name}</span>
            {Object.keys(event.arguments).length > 0 ? (
              <span className="ml-1 text-ink-400">
                {JSON.stringify(event.arguments).slice(0, 120)}
              </span>
            ) : null}
          </span>
        </div>
      );
    case "tool.result":
      return (
        <div className="flex items-start gap-2 pl-5 text-xs">
          {event.isError ? (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
          )}
          <span className={event.isError ? "text-amber-700" : "text-ink-400"}>
            {event.isError ? event.result.slice(0, 160) : `${event.result.length} chars returned`}
          </span>
        </div>
      );
    case "assistant.message":
      return (
        <div className="flex items-start gap-2 text-xs text-ink-600">
          <ChevronRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-ink-400" />
          <span className="whitespace-pre-wrap">{event.text.slice(0, 400)}</span>
        </div>
      );
    case "run.error":
      return (
        <div className="flex items-start gap-2 text-xs text-red-600">
          <CircleSlash className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>{event.message}</span>
        </div>
      );
    case "step.started":
      return (
        <div className="pt-2 text-[11px] font-medium uppercase tracking-wide text-ink-400">
          Step {event.step}
        </div>
      );
    default:
      return null;
  }
}

export default function AgentsPage() {
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [capsError, setCapsError] = useState<string | null>(null);

  const [workflowId, setWorkflowId] = useState("");
  const [providerId, setProviderId] = useState<ProviderId | "">("");
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<RunAttachment[]>([]);

  const [events, setEvents] = useState<RunEvent[]>([]);
  const [run, setRun] = useState<AgentRun | null>(null);
  const [running, setRunning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load providers + workflows once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/agents");
        if (!res.ok) throw new Error(`Failed to load agent config (${res.status})`);
        const data: Capabilities = await res.json();
        if (cancelled) return;
        setCaps(data);
        setWorkflowId(data.defaultWorkflowId);
        const firstUsable = data.providers.find((p) => p.configured);
        if (firstUsable) {
          setProviderId(firstUsable.id);
          setModel(firstUsable.defaultModel);
        }
      } catch (err) {
        if (!cancelled) setCapsError(errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Abort any in-flight run when the page unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [events]);

  const workflow = useMemo(
    () => caps?.workflows.find((w) => w.id === workflowId),
    [caps, workflowId],
  );
  const provider = useMemo(
    () => caps?.providers.find((p) => p.id === providerId),
    [caps, providerId],
  );
  const anyProviderConfigured = Boolean(caps?.providers.some((p) => p.configured));

  function selectProvider(id: ProviderId) {
    setProviderId(id);
    const next = caps?.providers.find((p) => p.id === id);
    setModel(next?.defaultModel ?? "");
  }

  async function attachFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setAttachments((prev) => [...prev, data as RunAttachment]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /**
   * Start a run and consume its SSE stream.
   *
   * Events are parsed off the raw body rather than with EventSource, which only
   * does GET — the run parameters have to go in a POST body.
   */
  async function startRun() {
    const text = prompt.trim();
    if (!text || running) return;

    const controller = new AbortController();
    abortRef.current = controller;

    setRunning(true);
    setError(null);
    setEvents([]);
    setRun(null);

    try {
      const res = await fetch("/api/agents/runs/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          workflowId,
          input: text,
          provider: providerId || undefined,
          model: model || undefined,
          attachments,
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Run failed to start (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line.
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const nameLine = frame.split("\n").find((l) => l.startsWith("event: "));
          const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!nameLine || !dataLine) continue;

          const name = nameLine.slice(7).trim();
          let payload: unknown;
          try {
            payload = JSON.parse(dataLine.slice(6));
          } catch {
            continue;
          }

          if (name === "event") {
            setEvents((prev) => [...prev, payload as RunEvent]);
          } else if (name === "run") {
            setRun(payload as AgentRun);
          } else if (name === "error") {
            setError((payload as { message: string }).message);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError(errorMessage(err));
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function cancelRun() {
    abortRef.current?.abort();
  }

  if (capsError) {
    return (
      <div>
        <PageHeader title="Agents" />
        <Card>
          <EmptyState
            icon={<AlertTriangle className="h-5 w-5" />}
            title="Could not load agent configuration"
            description={capsError}
          />
        </Card>
      </div>
    );
  }

  if (!caps) {
    return (
      <div>
        <PageHeader title="Agents" />
        <Card>
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Agents"
        description="Run an autonomous workflow over your live sponsorship data. Every agent gets the same platform system prompt and the same audited tools."
      />

      {!anyProviderConfigured ? (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3 p-4 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <div className="font-medium">No model provider is configured</div>
              <ul className="mt-1 space-y-0.5 text-xs">
                {caps.providers.map((p) => (
                  <li key={p.id}>
                    <span className="font-medium">{p.label}:</span> {p.reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* ----------------------------------------------------------------- */}
        {/* Configure                                                          */}
        {/* ----------------------------------------------------------------- */}
        <Card className="self-start">
          <CardHeader title="New run" description="Pick a workflow and a model." />
          <div className="space-y-4 p-4 pt-0">
            <Field label="Workflow" required>
              <Select value={workflowId} onChange={(e) => setWorkflowId(e.target.value)}>
                {caps.workflows.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label}
                  </option>
                ))}
              </Select>
            </Field>

            {workflow ? (
              <p className="-mt-2 text-xs text-ink-500">
                {workflow.description} Uses {workflow.toolNames.length} tools, up to{" "}
                {workflow.maxSteps} steps.
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Provider" required>
                <Select
                  value={providerId}
                  onChange={(e) => selectProvider(e.target.value as ProviderId)}
                >
                  {caps.providers.map((p) => (
                    <option key={p.id} value={p.id} disabled={!p.configured}>
                      {p.label}
                      {p.configured ? "" : " (not configured)"}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Model">
                <Select value={model} onChange={(e) => setModel(e.target.value)}>
                  {(provider?.models ?? []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {provider && !provider.configured ? (
              <p className="-mt-2 text-xs text-amber-700">{provider.reason}</p>
            ) : null}

            <Field
              label="Prompt"
              required
              hint={workflow ? `Example: ${workflow.samplePrompt}` : undefined}
            >
              <Textarea
                rows={5}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={workflow?.samplePrompt}
              />
            </Field>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-ink-700">
                  Attachments
                  {workflow?.expectsAttachment ? (
                    <span className="ml-1 text-red-500">*</span>
                  ) : null}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Paperclip className="h-3.5 w-3.5" />}
                  loading={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  Attach
                </Button>
              </div>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void attachFile(file);
                }}
              />
              {attachments.length === 0 ? (
                <p className="text-xs text-ink-400">
                  {workflow?.expectsAttachment
                    ? "This workflow reads an uploaded file."
                    : "Optional. Files are stored in S3 when configured."}
                </p>
              ) : (
                <ul className="space-y-1">
                  {attachments.map((a) => (
                    <li
                      key={a.key}
                      className="flex items-center justify-between rounded-md bg-ink-50 px-2 py-1 text-xs text-ink-700"
                    >
                      <span className="truncate">{a.fileName}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${a.fileName}`}
                        className="text-ink-400 hover:text-ink-700"
                        onClick={() =>
                          setAttachments((prev) => prev.filter((x) => x.key !== a.key))
                        }
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                icon={<Play className="h-4 w-4" />}
                loading={running}
                disabled={!prompt.trim() || !anyProviderConfigured}
                onClick={startRun}
              >
                {running ? "Running" : "Run agent"}
              </Button>
              {running ? (
                <Button variant="secondary" onClick={cancelRun}>
                  Cancel
                </Button>
              ) : null}
            </div>

            {error ? <p className="text-xs text-red-600">{error}</p> : null}
          </div>
        </Card>

        {/* ----------------------------------------------------------------- */}
        {/* Activity + result                                                  */}
        {/* ----------------------------------------------------------------- */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Activity"
              description="Tool calls and reasoning as they happen."
              action={run ? <StatusPill status={run.status} /> : null}
            />
            <div ref={logRef} className="max-h-[380px] overflow-y-auto px-4 pb-4">
              {events.length === 0 ? (
                <EmptyState
                  icon={<Bot className="h-5 w-5" />}
                  title={running ? "Starting…" : "No run yet"}
                  description={
                    running
                      ? "Waiting for the first model response."
                      : "Configure a workflow on the left and run it."
                  }
                />
              ) : (
                <div className="space-y-1.5">
                  {events.map((event, i) => (
                    <EventRow key={`${event.type}-${i}`} event={event} />
                  ))}
                </div>
              )}
            </div>
          </Card>

          {run ? (
            <Card>
              <CardHeader
                title="Result"
                description={`${run.provider} · ${run.model} · ${run.steps} step${
                  run.steps === 1 ? "" : "s"
                } · ${run.usage.inputTokens + run.usage.outputTokens} tokens`}
              />
              <div className="px-4 pb-4">
                {run.error ? (
                  <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {run.error}
                  </div>
                ) : null}
                {run.output ? (
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink-800">
                    {run.output}
                  </div>
                ) : (
                  <p className="text-sm text-ink-400">No output was produced.</p>
                )}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
