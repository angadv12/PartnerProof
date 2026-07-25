/**
 * Free, local, zero-API-key semantic search.
 *
 * `SearchEngine` is the seam for "fuzzy/free-text search" over any record type.
 * The MVP behavior — exact substring matching — is preserved verbatim in
 * `KeywordSearch`, which needs no dependencies and is the guaranteed fallback.
 * `SemanticSearch` adds embedding-based fuzzy matching on top: it embeds the
 * query and each record locally with Transformers.js (Xenova/all-MiniLM-L6-v2,
 * 384-dim) and ranks by cosine similarity. Ranking is HYBRID — exact substring
 * hits are always included and boosted, so semantic search never regresses the
 * current exact-match results; it only adds fuzzy matches and reranks.
 *
 * The factory `getSearchEngine()` returns `SemanticSearch` when the embedding
 * model is available and `KeywordSearch` otherwise, and it NEVER throws to the
 * caller: model load/embed failures fall back to keyword behavior, mirroring how
 * `LLMAssistant` / `LLMContractExtractor` fall back to their deterministic cores.
 *
 * Server-only (Node runtime): never import this from a client component.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Seam
// ---------------------------------------------------------------------------

export interface SearchEngine {
  /**
   * Filter + rank `items` by `query`. `textOf` returns the searchable text for a
   * record (e.g. title + description + notes). An empty query returns `items`
   * unchanged so callers can treat "no search" as a no-op.
   */
  search<T>(query: string, items: T[], textOf: (item: T) => string): Promise<T[]>;
}

// ---------------------------------------------------------------------------
// Keyword engine — current exact-substring behavior, preserved identically
// ---------------------------------------------------------------------------

/** Exact substring match, case-insensitive. This is the original behavior. */
export class KeywordSearch implements SearchEngine {
  async search<T>(query: string, items: T[], textOf: (item: T) => string): Promise<T[]> {
    const search = query.toLowerCase().trim();
    if (!search) return items;
    return items.filter((item) => textOf(item).toLowerCase().includes(search));
  }
}

// ---------------------------------------------------------------------------
// Embedding model — lazy singleton over Transformers.js
// ---------------------------------------------------------------------------

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

// the loaded pipeline, cached after the first successful load
type Embedder = (text: string) => Promise<Float32Array>;
let embedderPromise: Promise<Embedder> | null = null;

/**
 * Load the embedding pipeline once and reuse it. The first call performs a cold
 * model fetch/load (~1-2s, plus a one-time download on the very first run); warm
 * calls are fast. Returns a function that maps text to a normalized 384-dim
 * vector. Rejects if the model cannot be loaded so callers can fall back.
 */
function getEmbedder(): Promise<Embedder> {
  if (!embedderPromise) {
    embedderPromise = (async () => {
      // dynamic import keeps the heavy dep out of the module graph until needed
      const { pipeline } = await import("@huggingface/transformers");
      const extractor = await pipeline("feature-extraction", MODEL_ID);
      return async (text: string) => {
        // mean-pooled + normalized sentence embedding
        const output = await extractor(text, { pooling: "mean", normalize: true });
        return Float32Array.from(output.data as Iterable<number>);
      };
    })().catch((err) => {
      // reset so a later call can retry; surface the failure to the caller
      embedderPromise = null;
      throw err;
    });
  }
  return embedderPromise;
}

/** Cosine similarity for two normalized vectors (dot product suffices). */
function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}

// ---------------------------------------------------------------------------
// Embedding cache — sidecar JSON keyed by record id + content hash
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), ".data");
const CACHE_PATH = path.join(DATA_DIR, "embeddings.json");

interface CacheEntry {
  // sha-256 of the embedded text; the vector auto-invalidates when text changes
  hash: string;
  vector: number[];
}
type CacheShape = Record<string, CacheEntry>;

function contentHash(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function loadCache(): CacheShape {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")) as CacheShape;
  } catch {
    // missing or corrupt cache is non-fatal; start empty and recompute lazily
    return {};
  }
}

function saveCache(cache: CacheShape): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache), "utf8");
  } catch (err) {
    // a failed cache write must not break search; just log and move on
    console.warn("[search] could not persist embedding cache:", err);
  }
}

// ---------------------------------------------------------------------------
// Semantic engine — hybrid keyword + cosine ranking
// ---------------------------------------------------------------------------

/** Minimum cosine similarity for a non-exact match to be returned. */
const SIMILARITY_FLOOR = 0.3;
/** Score boost added when a record also contains the exact substring. */
const EXACT_BOOST = 1;

/**
 * Embedding-backed search with hybrid ranking. Exact substring matches are
 * always included and strongly boosted; semantic matches above the similarity
 * floor are unioned in. Final order is by combined score, descending.
 *
 * Records are keyed by id + content hash so cached vectors auto-invalidate when
 * the underlying text changes; only missing/stale vectors are (re)embedded per
 * search, so there is no migration step and no change to create/update paths.
 */
export class SemanticSearch implements SearchEngine {
  constructor(private readonly fallback: SearchEngine = new KeywordSearch()) {}

  async search<T>(query: string, items: T[], textOf: (item: T) => string): Promise<T[]> {
    const raw = query.trim();
    if (!raw) return items;

    try {
      const embed = await getEmbedder();
      const lowerQuery = raw.toLowerCase();
      const queryVec = await embed(raw);

      const cache = loadCache();
      let cacheDirty = false;

      const scored: { item: T; score: number; order: number }[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const text = textOf(item);
        const isExact = text.toLowerCase().includes(lowerQuery);

        // resolve the record vector from cache, embedding+caching on miss/stale
        const hash = contentHash(text);
        const key = `${idOf(item)}:${hash}`;
        let vector: Float32Array;
        const cached = cache[key];
        if (cached && cached.hash === hash) {
          vector = Float32Array.from(cached.vector);
        } else {
          vector = await embed(text);
          cache[key] = { hash, vector: Array.from(vector) };
          cacheDirty = true;
        }

        const sim = cosine(queryVec, vector);

        // hybrid score: exact substring always qualifies and gets a strong
        // boost; otherwise the record must clear the similarity floor
        if (isExact) {
          scored.push({ item, score: EXACT_BOOST + sim, order: i });
        } else if (sim >= SIMILARITY_FLOOR) {
          scored.push({ item, score: sim, order: i });
        }
      }

      if (cacheDirty) saveCache(cache);

      // sort by combined score desc; stable on original order for ties
      scored.sort((a, b) => b.score - a.score || a.order - b.order);
      return scored.map((s) => s.item);
    } catch (err) {
      // any model/embed failure: behave exactly like today (exact substring)
      console.warn("[search] semantic search unavailable, using keyword:", err);
      return this.fallback.search(query, items, textOf);
    }
  }
}

/**
 * Best-effort stable cache key component for a record. Records in this app all
 * carry an `id`; fall back to the content hash itself when one is absent.
 */
function idOf(item: unknown): string {
  if (item && typeof item === "object" && "id" in item) {
    const id = (item as { id: unknown }).id;
    if (typeof id === "string") return id;
  }
  return "anon";
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns `SemanticSearch` when the embedding model is available, else
 * `KeywordSearch`. The probe loads the model lazily; if it cannot be loaded,
 * search transparently falls back to exact substring matching. Set
 * `SEARCH_ENGINE=keyword` to force the keyword engine (useful for tests or to
 * skip the model download).
 */
let cachedEngine: SearchEngine | null = null;
export function getSearchEngine(): SearchEngine {
  if (cachedEngine) return cachedEngine;

  const keyword = new KeywordSearch();
  if (process.env.SEARCH_ENGINE === "keyword") {
    cachedEngine = keyword;
    return cachedEngine;
  }

  // semantic engine internally falls back to keyword on any runtime failure,
  // so returning it here is always safe; the model loads lazily on first search
  cachedEngine = new SemanticSearch(keyword);
  return cachedEngine;
}
