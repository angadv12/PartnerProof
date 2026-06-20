/**
 * Contract deliverable extraction.
 *
 * The `ContractExtractor` interface is the seam between PartnerProof and "AI".
 * For the MVP we ship a deterministic, rule-based `MockContractExtractor` that
 * needs no API key and reliably handles the sample sponsorship language. A real
 * LLM can be dropped in later behind the same interface — see `getContractExtractor`
 * and `LLMContractExtractor` — without touching any callers.
 */
import type { Category, ExtractedDeliverable, ExtractionContext, Priority } from "./types";

export interface ContractExtractor {
  extract(text: string, context: ExtractionContext): Promise<ExtractedDeliverable[]>;
}

// ---------------------------------------------------------------------------
// Number-word parsing helpers
// ---------------------------------------------------------------------------

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60,
};

function parseNumberToken(token: string): number | null {
  if (/^\d+$/.test(token)) return parseInt(token, 10);
  return WORD_NUMBERS[token.toLowerCase()] ?? null;
}

function tokenize(sentence: string): string[] {
  return sentence.toLowerCase().match(/[a-z0-9-]+/gi) ?? [];
}

/** Find the nearest number appearing just before any of `keywords`. */
function numberBeforeKeyword(sentence: string, keywords: string[]): number | null {
  const tokens = tokenize(sentence);
  for (let i = 0; i < tokens.length; i++) {
    if (keywords.includes(tokens[i])) {
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const n = parseNumberToken(tokens[j]);
        if (n != null) return n;
      }
    }
  }
  return null;
}

function firstNumber(sentence: string): number | null {
  for (const t of tokenize(sentence)) {
    const n = parseNumberToken(t);
    if (n != null) return n;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rule definitions — each detects one obligation pattern
// ---------------------------------------------------------------------------

interface Rule {
  id: string;
  title: string;
  category: Category;
  priority: Priority;
  /** True when this sentence describes the obligation. */
  detect: (lower: string) => boolean;
  /** Resolve the required quantity and unit from the sentence. */
  quantity: (sentence: string) => { value: number; unit?: string };
}

const RULES: Rule[] = [
  {
    id: "homepage-logo",
    title: "Logo placement on team homepage",
    category: "Digital",
    priority: "High",
    detect: (s) =>
      /\blogo\b/.test(s) && /(homepage|home page|website|team site)/.test(s),
    quantity: (s) => ({
      value: numberBeforeKeyword(s, ["days", "day"]) ?? 30,
      unit: "days",
    }),
  },
  {
    id: "instagram-posts",
    title: "Sponsored Instagram posts",
    category: "Social",
    priority: "Medium",
    detect: (s) =>
      /instagram/.test(s) ||
      (/(sponsored|social)/.test(s) && /\bposts?\b/.test(s)),
    quantity: (s) => ({
      value: numberBeforeKeyword(s, ["posts", "post", "instagram"]) ?? firstNumber(s) ?? 1,
      unit: "posts",
    }),
  },
  {
    id: "led-board",
    title: "LED board exposure during home games",
    category: "In-arena",
    priority: "High",
    detect: (s) => /led\s*(board|signage|exposure|ribbon)/.test(s) || /\bled\b/.test(s),
    quantity: (s) => ({
      value: numberBeforeKeyword(s, ["games", "game"]) ?? firstNumber(s) ?? 1,
      unit: "games",
    }),
  },
  {
    id: "halftime-activation",
    title: "Halftime fan activation",
    category: "In-arena",
    priority: "Medium",
    detect: (s) => /(halftime|half-time)/.test(s) || /fan activation/.test(s),
    quantity: (s) => ({
      value: numberBeforeKeyword(s, ["activation", "activations", "halftime"]) ?? 1,
    }),
  },
  {
    id: "email-campaign",
    title: "Email campaign to season ticket holders",
    category: "Email",
    priority: "High",
    detect: (s) =>
      /email/.test(s) || /newsletter/.test(s) || /season ticket holders/.test(s),
    quantity: (s) => ({
      value: numberBeforeKeyword(s, ["email", "campaign", "campaigns", "newsletter"]) ?? 1,
    }),
  },
  {
    id: "recap-report",
    title: "Post-season recap report",
    category: "Content",
    priority: "Medium",
    detect: (s) =>
      /recap report/.test(s) ||
      /post-?season recap/.test(s) ||
      (/recap/.test(s) && /(report|proof|performance notes|screenshots)/.test(s)),
    quantity: () => ({ value: 1 }),
  },
  {
    id: "recap-article",
    title: "Sponsor mention in game recap articles",
    category: "Content",
    priority: "Low",
    detect: (s) =>
      (/recap article|game recap/.test(s) && !/recap report/.test(s)) ||
      (/mention/.test(s) && /article/.test(s)),
    quantity: (s) => ({
      value: numberBeforeKeyword(s, ["articles", "article", "recaps", "games"]) ?? firstNumber(s) ?? 1,
    }),
  },
  {
    id: "vip-suite",
    title: "VIP suite / hospitality access",
    category: "Hospitality",
    priority: "Medium",
    detect: (s) => /suite|vip|hospitality|premium seats/.test(s),
    quantity: (s) => ({
      value: numberBeforeKeyword(s, ["games", "game", "suites", "suite"]) ?? firstNumber(s) ?? 1,
      unit: "games",
    }),
  },
  {
    id: "kit-branding",
    title: "Jersey / kit branding",
    category: "Broadcast",
    priority: "High",
    detect: (s) => /jersey|kit|apparel|uniform|patch/.test(s),
    quantity: (s) => ({
      value: numberBeforeKeyword(s, ["games", "game"]) ?? firstNumber(s) ?? 1,
      unit: "games",
    }),
  },
  {
    id: "signage",
    title: "In-arena signage & branding",
    category: "In-arena",
    priority: "Low",
    detect: (s) =>
      /(concourse|courtside|sideline|arena)\s+(signage|branding)/.test(s) ||
      /\bsignage\b/.test(s),
    quantity: () => ({ value: 1 }),
  },
];

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Deterministic, dependency-free extractor.
 * Walks each sentence, fires matching rules (each rule at most once — first hit
 * wins), and returns structured deliverables the user can review before saving.
 */
export class MockContractExtractor implements ContractExtractor {
  async extract(text: string, _context: ExtractionContext): Promise<ExtractedDeliverable[]> {
    const sentences = splitSentences(text);
    const seen = new Set<string>();
    const results: ExtractedDeliverable[] = [];

    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      for (const rule of RULES) {
        if (seen.has(rule.id)) continue;
        if (!rule.detect(lower)) continue;
        const { value, unit } = rule.quantity(sentence);
        seen.add(rule.id);
        results.push({
          title: rule.title,
          description: sentence,
          category: rule.category,
          quantityRequired: Math.max(1, value),
          unit,
          priority: rule.priority,
          sourceText: sentence,
        });
      }
    }

    return results;
  }
}

// ---------------------------------------------------------------------------
// LLM provider hook (extension point — never blocks the MVP)
// ---------------------------------------------------------------------------

/** Prompt a real model would receive; exported so the wiring is obvious. */
export function buildExtractionPrompt(text: string, context: ExtractionContext): string {
  return [
    "You are a sponsorship contract analyst. Extract every sponsor obligation as JSON.",
    context.sponsorName ? `Sponsor: ${context.sponsorName}` : "",
    context.season ? `Season: ${context.season}` : "",
    "For each obligation return: title, description, category (Social|Digital|Broadcast|In-arena|Hospitality|Email|Content|Other),",
    "quantityRequired (number), unit, priority (Low|Medium|High), sourceText (the exact clause).",
    "Contract text:",
    text,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Wraps a real provider but always falls back to the mock so the app never
 * breaks when a key is missing or the call fails. Wire the TODO to a real SDK
 * call (Anthropic / OpenAI) using `buildExtractionPrompt`.
 */
export class LLMContractExtractor implements ContractExtractor {
  constructor(private readonly fallback: ContractExtractor) {}

  async extract(text: string, context: ExtractionContext): Promise<ExtractedDeliverable[]> {
    try {
      // TODO: call the provider here, e.g.
      //   const res = await anthropic.messages.create({ model: "claude-...", ... });
      //   return JSON.parse(res...) as ExtractedDeliverable[];
      throw new Error("LLM provider not wired up yet");
    } catch (err) {
      console.warn("[extractor] LLM unavailable, using deterministic mock:", err);
      return this.fallback.extract(text, context);
    }
  }
}

/** Factory: returns the configured extractor, defaulting to the mock. */
export function getContractExtractor(): ContractExtractor {
  const mock = new MockContractExtractor();
  const provider = process.env.AI_PROVIDER ?? "mock";
  const hasKey =
    (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) ||
    (provider === "openai" && process.env.OPENAI_API_KEY);
  return hasKey ? new LLMContractExtractor(mock) : mock;
}
