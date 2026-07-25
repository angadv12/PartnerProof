# PartnerProof — working notes

Sponsorship activation & fulfillment platform for pro sports teams. Next.js 16 (App
Router) + React 18 + Tailwind, TypeScript strict, file-backed JSON store. No database
server, no required API keys — it runs seeded on first `npm run dev`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Production build (type-checks) |
| `npm run lint` | ESLint. **4 warnings in `src/lib/use-async.ts` are pre-existing** — 0 errors is the bar |
| `npm run seed` / `npm run reset` | Restore the seed dataset |
| `npm run smoke:agent` | End-to-end agent tests against a stub server. **No API key needed** |
| `npm run context:budget` | Per-workflow context cost, for sizing a local model |

`npm run smoke:agent` is the real test suite for the agent layer. Run it after touching
anything under `src/lib/agents/` or `src/lib/storage/`.

## Layout

```
src/lib/
  types.ts            domain entities + view models (single source of truth)
  db.ts               JSON store (.data/db.json)
  services.ts         business logic behind every API route
  metrics.ts          fulfillment / health roll-ups
  extractor.ts        ContractExtractor seam + rule-based mock
  assistant.ts        AssistantEngine seam + rule engine
  agents/
    types.ts          provider-agnostic contracts
    system-prompt.ts  platform prompt injected into EVERY agent
    runtime.ts        the tool-calling loop
    workflows.ts      named agent configs (tools + role + step budget)
    request.ts        HTTP request validation and bounds
    store.ts          run persistence
    providers/        anthropic.ts (own protocol) + openai-compatible.ts + catalog.ts
    tools/            domain tools wrapping the service layer
  storage/            Storage interface · s3.ts · local.ts
```

Routes are thin — they parse, call a service or the runtime, and serialize. Logic lives in
`services.ts` or `agents/`.

## Invariants

These are load-bearing. Several were bugs found in review; breaking them silently
reintroduces the bug.

**The platform system prompt cannot be bypassed.** `runtime.ts` is the only path to a
provider and always calls `buildSystemPrompt()`. A workflow appends a role; it can never
opt out. `smoke:agent` asserts the preamble is present and first on *every* request.

**A workflow gets `read_attachment` OR write tools, never both.** Uploaded text is
untrusted; pairing it with a mutation tool is a prompt-injection path to writing records.
Enforced by `findWorkflowsMixingAttachmentsAndWrites()` and asserted in `smoke:agent`.

**No caller-controlled text reaches the system prompt.** Attachments are listed by
server-generated ordinal and byte size (`- file 1 (10 bytes)`), never by filename. Character
filtering does not work here — stripping punctuation leaves instruction-shaped language
intact. Real filenames come back only in tool *results*, which the model already treats as
data. `read_attachment` takes a numeric ordinal.

**`saveDb` must stay atomic** (temp file + rename). Writing in place leaves a window where
a reader sees half-written JSON — and `getDb` treats invalid JSON as corruption and
*reseeds*, turning a transient race into total data loss.

**No `await` inside a read-modify-write.** `getDb()` → mutate → `saveDb()` must be
synchronous. The store is a whole-file snapshot, so awaiting in the middle means the write
clobbers anything that landed meanwhile. See `uploadEvidence` for the correct shape:
validate, await the upload, *then* re-read for the mutation.

**Anthropic `providerRaw` is replayed verbatim.** Claude's thinking blocks must be echoed
back unmodified on the next turn or the API rejects them, so the raw content blocks ride
along on the assistant message. Don't normalize them to text.

**No sampling parameters.** `temperature` / `top_p` / `top_k` are rejected (400) on current
reasoning models, and omitting them is also the most portable choice across local servers.
Steer with the prompt.

**Tool failures return to the model as error results, never throw.** A bad argument or a
hallucinated tool name should cost one turn, not the run.

**Turns fan out only when every call is read-only.** If the model mixes in a write, the
whole turn runs serially in the order it asked for — otherwise reads resolve against
pre-write state while the transcript implies otherwise.

## Providers

Anthropic has its own adapter (different protocol). OpenAI, Gemini, self-hosted, and any
other gateway all speak Chat Completions, so they share `OpenAICompatibleProvider` and
differ only by an entry in `providers/catalog.ts`.

**Adding a vendor:** add its id to `ProviderId` + `PROVIDER_IDS` in `agents/types.ts`, then
one entry in `catalog.ts`. It appears in the UI picker automatically. `buildRegistry()`
throws at import if an id has no entry.

Nothing outside `providers/` imports a vendor SDK.

## Conventions

- Comments explain *why*, not what. Skip them when the code already says it.
- Comment style: lowercase, only comma/colon/semicolon punctuation.
- Use existing UI primitives from `src/components/ui`.
- `Database` fields added after the fact are optional (`agentRuns?`) so existing
  `.data/db.json` files don't need a reseed.

## Known gaps — do not "fix" silently

**No authentication anywhere.** Every route is public. This predates the agent work and
applies to the whole app. Agents raise the stakes since some workflows write. A real
deployment needs auth on every route plus per-team scoping of runs, attachments, and tool
operations.

**Concurrent writes are last-writer-wins across processes.** The atomic rename removes the
torn-file hazard but does not serialize snapshots. Inherent to a whole-file JSON store
without cross-process locking; the fix is a real database, which `db.ts`'s repository shape
is designed to make localized.
