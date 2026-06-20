"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { useAsyncData } from "@/lib/use-async";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { errorMessage } from "@/lib/utils";
import { Card, PageHeader, Spinner } from "@/components/ui";
import { CategoryChip, StatusBadge } from "@/components/ui/badges";
import type { AssistantResponse } from "@/lib/types";

interface Message {
  role: "user" | "assistant";
  text?: string;
  response?: AssistantResponse;
}

const DEFAULT_SUGGESTIONS = [
  "What do we still owe Pepsi?",
  "Which deliverables are at risk this month?",
  "Show me all social obligations for Nike",
  "What evidence do we have for in-arena activations?",
  "Generate a renewal summary for Gatorade",
];

const GREETING: Message = {
  role: "assistant",
  response: {
    kind: "help",
    answer:
      "Hi! I'm your PartnerProof assistant. Ask me about sponsor obligations and status — what's owed, what's at risk, the evidence on file, or a renewal summary.",
    suggestions: DEFAULT_SUGGESTIONS,
  },
};

export default function AssistantPage() {
  const sponsors = useAsyncData(() => api.sponsors());
  const sponsorName = (id: string) =>
    (sponsors.data ?? []).find((s) => s.id === id)?.name ?? "—";

  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function ask(query: string) {
    const q = query.trim();
    if (!q || loading) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    try {
      const response = await api.assistant(q);
      setMessages((m) => [...m, { role: "assistant", response }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: `Sorry — ${errorMessage(err)}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Assistant"
        description="Ask questions about sponsor obligations and fulfillment in plain language."
      />

      <Card className="flex h-[calc(100vh-220px)] min-h-[480px] flex-col">
        {/* Conversation */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-brand-600 px-4 py-2.5 text-sm text-white">
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={i} className="flex gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-ink-100 px-4 py-2.5 text-sm text-ink-800">
                    {m.text ?? m.response?.answer}
                  </div>
                  {m.response ? <ResponsePayload response={m.response} sponsorName={sponsorName} onAsk={ask} /> : null}
                </div>
              </div>
            )
          )}

          {loading ? (
            <div className="flex items-center gap-3 text-sm text-ink-400">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Sparkles className="h-4 w-4" />
              </div>
              <Spinner className="h-4 w-4" /> Thinking…
            </div>
          ) : null}
        </div>

        {/* Input */}
        <div className="border-t border-ink-100 p-3 sm:p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex items-center gap-2"
          >
            <input
              className="input-base"
              placeholder="Ask about obligations, risk, evidence, or renewals…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="focus-ring flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-50"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}

function ResponsePayload({
  response,
  sponsorName,
  onAsk,
}: {
  response: AssistantResponse;
  sponsorName: (id: string) => string;
  onAsk: (q: string) => void;
}) {
  return (
    <div className="max-w-[85%] space-y-3">
      {/* Facts (summary) */}
      {response.facts && response.facts.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {response.facts.map((f) => (
            <div key={f.label} className="rounded-lg border border-ink-100 bg-white px-3 py-2">
              <div className="text-base font-semibold text-ink-900">{f.value}</div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-ink-400">
                {f.label}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Deliverables */}
      {response.deliverables && response.deliverables.length > 0 ? (
        <div className="divide-y divide-ink-100 overflow-hidden rounded-lg border border-ink-100 bg-white">
          {response.deliverables.slice(0, 8).map((d) => (
            <div key={d.id} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink-800">
                {d.title}
              </span>
              <span className="hidden text-[11px] text-ink-400 sm:block">{sponsorName(d.sponsorId)}</span>
              <CategoryChip category={d.category} />
              <StatusBadge status={d.status} />
            </div>
          ))}
        </div>
      ) : null}

      {/* Evidence */}
      {response.evidence && response.evidence.length > 0 ? (
        <div className="divide-y divide-ink-100 overflow-hidden rounded-lg border border-ink-100 bg-white">
          {response.evidence.slice(0, 8).map((e) => (
            <div key={e.id} className="flex items-center gap-2 px-3 py-2 text-xs">
              <span className="min-w-0 flex-1 truncate font-medium text-ink-800">{e.title}</span>
              <span className="text-ink-400">{sponsorName(e.sponsorId)}</span>
              <span className="text-ink-400">{formatDate(e.activationDate)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* Suggestions */}
      {response.suggestions && response.suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {response.suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onAsk(s)}
              className="focus-ring rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
