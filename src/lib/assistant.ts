/**
 * Natural-language assistant over local sponsorship data.
 *
 * `AssistantEngine` is the seam for "AI Q&A". The MVP ships `RuleBasedAssistant`,
 * which recognizes common partnership questions (what's owed, what's at risk,
 * evidence lookups, renewal summaries) and answers from the local store — no LLM
 * required. A real model can be added behind the same interface via the factory.
 */
import { formatCompactCurrency } from "./format";
import { fulfillmentPercent, statusCounts } from "./metrics";
import type {
  AssistantResponse,
  Category,
  Database,
  Deliverable,
  Sponsor,
} from "./types";

export interface AssistantEngine {
  answer(query: string, db: Database): Promise<AssistantResponse>;
}

const CATEGORY_KEYWORDS: [Category, string[]][] = [
  ["Social", ["social", "instagram", "tiktok", "twitter", "post", "posts"]],
  ["Email", ["email", "newsletter"]],
  ["Hospitality", ["hospitality", "suite", "vip", "premium seat"]],
  ["In-arena", ["in-arena", "in arena", "arena", "led", "halftime", "signage", "concourse"]],
  ["Broadcast", ["broadcast", "televised", "jersey", "kit", "courtside"]],
  ["Digital", ["digital", "homepage", "website", "banner"]],
  ["Content", ["content", "article", "feature", "blog"]],
];

function detectCategory(q: string): Category | undefined {
  for (const [category, words] of CATEGORY_KEYWORDS) {
    if (words.some((w) => q.includes(w))) return category;
  }
  return undefined;
}

function isThisMonth(dueDate?: string): boolean {
  if (!dueDate) return false;
  const now = new Date();
  const d = new Date(dueDate.length === 10 ? `${dueDate}T00:00:00` : dueDate);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

const SUGGESTIONS = [
  "What do we still owe Pepsi?",
  "Which deliverables are at risk this month?",
  "Show me all social obligations for Nike",
  "What evidence do we have for in-arena activations?",
  "Generate a renewal summary for Gatorade",
];

function countsLine(list: Deliverable[]): string {
  const c = statusCounts(list);
  const parts = [
    c.missed ? `${c.missed} missed` : "",
    c.atRisk ? `${c.atRisk} at risk` : "",
    c.pending ? `${c.pending} pending` : "",
    c.delivered ? `${c.delivered} delivered` : "",
  ].filter(Boolean);
  return parts.join(", ");
}

export class RuleBasedAssistant implements AssistantEngine {
  async answer(query: string, db: Database): Promise<AssistantResponse> {
    const q = query.toLowerCase().trim();
    if (!q) return this.help();

    const sponsor = db.sponsors.find((s) => q.includes(s.name.toLowerCase()));
    const category = detectCategory(q);
    const sponsorLabel = sponsor ? sponsor.name : "all sponsors";

    const inScope = (d: Deliverable) =>
      (!sponsor || d.sponsorId === sponsor.id) &&
      (!category || d.category === category);
    const scope = db.deliverables.filter(inScope);

    // 1) Renewal / summary
    if (/(renewal|summary|recap|overview|how are we doing|health)/.test(q)) {
      return this.summary(db, sponsor);
    }

    // 2) Evidence / proof
    if (/(evidence|proof|screenshot|asset|documentation)/.test(q)) {
      const evidence = db.evidence.filter((e) => {
        if (sponsor && e.sponsorId !== sponsor.id) return false;
        if (category) {
          const d = db.deliverables.find((x) => x.id === e.deliverableId);
          if (!d || d.category !== category) return false;
        }
        return true;
      });
      const scopeText = [category, sponsor ? `for ${sponsor.name}` : ""]
        .filter(Boolean)
        .join(" ");
      return {
        kind: "evidence",
        evidence,
        suggestions: SUGGESTIONS,
        answer: evidence.length
          ? `Found ${evidence.length} evidence item${evidence.length === 1 ? "" : "s"} ${scopeText || "across all partners"}.`.replace(/\s+/g, " ").trim()
          : `No evidence captured yet ${scopeText || ""}. Attach proof from the Evidence page or a deliverable.`.trim(),
      };
    }

    // 3) At risk (optionally scoped to "this month")
    if (/(at risk|at-risk|risk|behind|slipping)/.test(q)) {
      let list = scope.filter((d) => d.status === "At Risk");
      const monthly = /(this month|this week|soon|upcoming)/.test(q);
      if (monthly) list = list.filter((d) => isThisMonth(d.dueDate));
      return {
        kind: "deliverables",
        deliverables: list,
        suggestions: SUGGESTIONS,
        answer: list.length
          ? `${list.length} at-risk obligation${list.length === 1 ? "" : "s"} for ${sponsorLabel}${monthly ? " due this month" : ""}. Prioritize before season close.`
          : `Nothing flagged at risk for ${sponsorLabel}${monthly ? " this month" : ""}. 👍`,
      };
    }

    // 4) Missed / missing
    if (/(missed|missing|did ?n.t|did not|dropped|failed)/.test(q)) {
      const list = scope.filter((d) => d.status === "Missed");
      return {
        kind: "deliverables",
        deliverables: list,
        suggestions: SUGGESTIONS,
        answer: list.length
          ? `${list.length} missed obligation${list.length === 1 ? "" : "s"} for ${sponsorLabel}. Address these in renewal conversations with a make-good.`
          : `No missed obligations for ${sponsorLabel}. Clean record.`,
      };
    }

    // 5) Owe / outstanding / remaining
    if (/(owe|owed|outstanding|remaining|left|still|open|to do|todo)/.test(q)) {
      const list = scope.filter((d) => d.status !== "Delivered");
      return {
        kind: "deliverables",
        deliverables: list,
        suggestions: SUGGESTIONS,
        answer: list.length
          ? `We still owe ${sponsorLabel} ${list.length} obligation${list.length === 1 ? "" : "s"} (${countsLine(list)}).`
          : `Everything is delivered for ${sponsorLabel}. Nothing outstanding.`,
      };
    }

    // 6) Delivered / completed
    if (/(delivered|completed|done|fulfilled|finished|complete)/.test(q)) {
      const list = scope.filter((d) => d.status === "Delivered");
      return {
        kind: "deliverables",
        deliverables: list,
        suggestions: SUGGESTIONS,
        answer: `${list.length} delivered obligation${list.length === 1 ? "" : "s"} for ${sponsorLabel}${category ? ` in ${category}` : ""}.`,
      };
    }

    // 7) Category / sponsor obligation listing
    if (category || sponsor || /(obligation|deliverable|owe|activation)/.test(q)) {
      const title = `${category ? `${category} ` : ""}obligations for ${sponsorLabel}`;
      return {
        kind: "deliverables",
        deliverables: scope,
        suggestions: SUGGESTIONS,
        answer: scope.length
          ? `${scope.length} ${title} (${countsLine(scope)}).`
          : `No ${title} on file.`,
      };
    }

    // 8) Fallback help
    return this.help();
  }

  private summary(db: Database, sponsor?: Sponsor): AssistantResponse {
    const list = sponsor
      ? db.deliverables.filter((d) => d.sponsorId === sponsor.id)
      : db.deliverables;
    const counts = statusCounts(list);
    const fulfillment = fulfillmentPercent(list);
    const name = sponsor?.name ?? "Portfolio";
    const value = sponsor
      ? db.contracts
          .filter((c) => c.sponsorId === sponsor.id)
          .reduce((s, c) => s + (c.value ?? 0), 0)
      : db.contracts.reduce((s, c) => s + (c.value ?? 0), 0);

    const facts = [
      { label: "Fulfillment", value: `${fulfillment}%` },
      { label: "Delivered", value: `${counts.delivered}/${counts.total}` },
      { label: "At risk", value: `${counts.atRisk}` },
      { label: "Missed", value: `${counts.missed}` },
      { label: sponsor ? "Contract value" : "Portfolio value", value: formatCompactCurrency(value) },
    ];

    const open = list.filter((d) => d.status !== "Delivered");
    const headline =
      fulfillment >= 90
        ? `${name} is on track at ${fulfillment}% fulfillment`
        : fulfillment >= 75
          ? `${name} is largely on track at ${fulfillment}% fulfillment, with a few items to close`
          : `${name} needs attention at ${fulfillment}% fulfillment`;

    const talking =
      counts.missed > 0
        ? `Lead with delivered wins, acknowledge ${counts.missed} missed item${counts.missed === 1 ? "" : "s"} with a proposed make-good, and frame renewal around the ${counts.delivered} delivered activations.`
        : `Strong delivery record — anchor the renewal on ${counts.delivered} delivered activations and proposed upsells.`;

    return {
      kind: "summary",
      facts,
      deliverables: open,
      suggestions: SUGGESTIONS,
      answer: `${headline}. ${talking}`,
    };
  }

  private help(): AssistantResponse {
    return {
      kind: "help",
      suggestions: SUGGESTIONS,
      answer:
        "Ask me about sponsor obligations and status. I can look up what's owed, what's at risk, what's been delivered, the evidence on file, or draft a renewal summary.",
    };
  }
}

/**
 * LLM-backed assistant hook. Falls back to the rule engine on any failure so the
 * assistant always answers. Wire the TODO to a provider that receives the query
 * plus a compact JSON snapshot of the data.
 */
export class LLMAssistant implements AssistantEngine {
  constructor(private readonly fallback: AssistantEngine) {}

  async answer(query: string, db: Database): Promise<AssistantResponse> {
    try {
      // TODO: send `query` + a serialized view of `db` to the provider and map
      // the response into AssistantResponse.
      throw new Error("LLM assistant not wired up yet");
    } catch (err) {
      console.warn("[assistant] LLM unavailable, using rule engine:", err);
      return this.fallback.answer(query, db);
    }
  }
}

export function getAssistant(): AssistantEngine {
  const rules = new RuleBasedAssistant();
  const provider = process.env.AI_PROVIDER ?? "mock";
  const hasKey =
    (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) ||
    (provider === "openai" && process.env.OPENAI_API_KEY);
  return hasKey ? new LLMAssistant(rules) : rules;
}
