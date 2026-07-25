# PartnerProof

**Sponsorship activation & fulfillment platform for professional sports teams.**

PartnerProof helps a team's partnership department _prove that sponsor obligations were
delivered_. Teams upload sponsorship contracts, the app extracts the deliverables, tracks
fulfillment, stores evidence, flags missing obligations, and generates sponsor-ready recap
reports — turning a scattered spreadsheet workflow into one measurable system.

> This MVP targets the **"Sponsor proof-of-outcome"** white space identified in the market
> research: sponsors increasingly want proof of delivered value, and teams still struggle to
> connect activations to evidence and renewals. PartnerProof is a narrow, ROI-verifiable wedge
> for the SVP of Partnerships persona.

The demo ships with a fictional team — the **Harbor City Breakers** — and three seeded
sponsors (**Pepsi, Nike, Gatorade**), so every screen is populated on first load.

---

## ✨ What's inside

| # | Feature | Where |
|---|---------|-------|
| 1 | **Dashboard** — active contracts, deliverable counts, at-risk/missed flags, upcoming deadlines, sponsor health, recent evidence | `/` |
| 2 | **Contracts** — cards with sponsor, season, value, dates, status, fulfillment % | `/contracts` |
| 3 | **Upload contract** — paste text / load sample / upload `.txt`, extract deliverables, review & save | `/contracts/new` |
| 4 | **Contract detail** — sponsor overview, fulfillment, deliverables grouped by category, evidence timeline, "needs attention" callout | `/contracts/[id]` |
| 5 | **Deliverables board** — kanban by status with sponsor/category/priority/search filters; edit, change status, increment quantity, mark delivered, attach evidence | `/deliverables` |
| 6 | **Evidence** — gallery of activation proof; add image/screenshot/URL/text-note evidence | `/evidence` |
| 7 | **Recap report** — printable, sponsor-facing recap with highlights, delivered activations, evidence, and renewal talking points | `/contracts/[id]/recap` |
| 8 | **Assistant** — rule-based natural-language Q&A over local data | `/assistant` |

---

## 🚀 Quick start

**Prerequisites:** Node.js 18.18+ (tested on Node 22). No database server and **no API keys** required.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The data store auto-seeds on first run.

To build and run the production server instead:

```bash
npm run build
npm start
```

### Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the dev server (http://localhost:3000) |
| `npm run build` | Production build (type-checks + lints) |
| `npm start` | Run the production server |
| `npm run lint` | Run ESLint |
| `npm run seed` / `npm run reset` | Reset the local data store to the seed dataset |
| `npm run smoke:agent` | End-to-end agent-runtime test against a stub model (no API key needed) |

> **Reset during a demo:** click around, change statuses, add evidence — then run
> `npm run reset` (or `POST /api/reset`) to restore the pristine seed data.

---

## 🤖 AI: mocked by default, real-LLM ready

The brief requires that **missing API keys never block the app**. Both AI features run on
deterministic logic out of the box:

- **`ContractExtractor`** (`src/lib/extractor.ts`) — a rule-based `MockContractExtractor`
  parses sponsorship language into structured deliverables (category, quantity, priority,
  source clause). It reliably handles the sample contract.
- **`AssistantEngine`** (`src/lib/assistant.ts`) — a `RuleBasedAssistant` recognizes common
  partnership questions (what's owed / at risk / delivered, evidence lookups, renewal summaries).

Both sit behind an interface with a factory (`getContractExtractor()`, `getAssistant()`).
To plug in a real model, set environment variables (see `.env.example`) and implement the
clearly-marked `TODO` in the `LLMContractExtractor` / `LLMAssistant` classes — they already
fall back to the mock on any failure, so the app never breaks.

```bash
# .env.local (optional)
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 🕹️ Agentic workflows

`/agents` runs autonomous, tool-calling agents over live platform data. An agent picks its
own tools, calls them in a loop, and answers from what it actually retrieved.

**Three providers, one interface.** `src/lib/agents/providers/` adapts Anthropic (Messages
API), OpenAI (Chat Completions), and any local OpenAI-compatible server — Ollama, LM Studio,
vLLM — to a single `LLMProvider` contract. Nothing above that directory imports a vendor SDK,
so a run can switch providers by changing one dropdown. Unconfigured providers surface in the
UI as disabled with the reason, instead of failing mid-run.

**One system prompt, injected everywhere.** `src/lib/agents/system-prompt.ts` holds the
platform preamble — domain context, grounding rules, output style, and boundaries. The
runtime is the only path to a provider and it always prepends this text, so a workflow can
append a role but can never opt out. It sits at the front of the prompt, which also makes it
the cacheable prefix.

**Tools are the service layer.** Each tool in `src/lib/agents/tools/` wraps an existing
service function, so agents obey the same business rules as the UI. Tool failures return to
the model as error results rather than exceptions — a bad argument costs one turn, not the
run. Read-only tools run concurrently; writes are serialized.

**Workflows** (`src/lib/agents/workflows.ts`) are named configurations — tool allowlist, role
instructions, step budget:

| Workflow | Does |
|----------|------|
| `partnership-analyst` | Answers portfolio questions from live data |
| `risk-audit` | Sweeps for at-risk/missed obligations, proposes make-goods |
| `recap-writer` | Builds an evidence-backed recap and persists it |
| `fulfillment-updater` | Reconciles records against evidence, applies approved changes |
| `contract-intake` | Reads an uploaded contract, proposes deliverables |

Runs stream over SSE so tool calls appear as they happen. Hitting the step limit triggers one
final tool-free call, and the run is reported `incomplete` — never a silent `succeeded`.

### Guardrails

| Risk | Mitigation |
|------|-----------|
| Prompt injection via an uploaded file | A workflow gets `read_attachment` **or** write tools, never both — an injected instruction has nothing to reach for. Enforced as an invariant by `npm run smoke:agent`, not just by prompt wording. |
| Reading arbitrary bucket objects | Run attachments must reference a key under the agent-upload prefix, so a run can only read something uploaded for a run. |
| Binary files quoted as contract text | `read_attachment` detects binary payloads and refuses, instead of handing the model decoded noise it would quote as clauses. |
| Runaway provider spend | Requested models must be ones the provider advertises; concurrent runs are capped (`AGENT_MAX_CONCURRENT_RUNS`, default 4); every workflow has a step budget. |
| Cancellation racing a mutation | The abort signal is re-checked after each model call and between tool calls, so a cancel cannot let queued writes through. |
| Injection via attachment *metadata* | Attachments are listed in the system prompt by server-generated ordinal and byte size — never by filename. No character filter can strip instruction-shaped language while leaving a readable name, so caller text simply never reaches the system role; the real filename comes back through a tool result. A workflow without `read_attachment` refuses attachments outright. |
| Torn reads of the JSON store | `saveDb` writes to a temp file and renames. Without this, a reader hitting a half-written file would see invalid JSON — which the store treats as corruption and reseeds from, turning a race into total data loss. |

Two limits are known and deliberately not papered over:

> **Authentication and tenancy.** No route in this app has an auth boundary —
> that predates this change and is a property of the demo, not something
> introduced by the agent layer. But agents raise the stakes, since some
> workflows write. Before any real deployment: authenticate every route, scope
> runs, attachments, and tool operations to a team, and replace the
> process-local concurrency cap with per-user quotas.

> **Concurrent writes are last-writer-wins.** The atomic rename above removes the
> torn-file hazard, but it does not serialize snapshots: two processes can each
> read version N, mutate different records, and the second rename silently drops
> the first change. Every `getDb`/`saveDb` pair in the app has always had this
> property — a whole-file JSON store cannot avoid it without cross-process
> locking. The concurrency cap is per-process for the same reason. The fix is a
> real database, which `db.ts`'s repository-shaped access is designed to make a
> localized change.

### File uploads

`src/lib/storage/` abstracts uploads behind a `Storage` interface with two drivers: **S3**
(used automatically when `S3_BUCKET` is set) and local disk (the zero-config default).
Callers only ever handle opaque keys. The bucket stays private — reads are served as
short-lived presigned URLs via `/api/files/[...path]`, and `POST /api/uploads?presign=1`
returns a presigned PUT so large files never transit the app server.

---

## 🗂️ Project structure

```
src/
  app/
    page.tsx                     # Dashboard
    contracts/                   # list · new (upload) · [id] detail · [id]/recap
    deliverables/                # kanban board
    evidence/                    # evidence gallery
    recaps/                      # recap index
    assistant/                   # AI assistant
    agents/                      # agentic workflow console
    api/                         # REST API (route handlers)
      contracts, contracts/[id], contracts/[id]/recap,
      deliverables, deliverables/[id], extract, evidence,
      assistant, dashboard, sponsors, files/[...path], reset,
      agents, agents/runs, agents/runs/[id], agents/runs/stream, uploads
  components/
    AppShell.tsx                 # sidebar + topbar shell
    DeliverableModal, EvidenceModal, EvidenceThumb
    ui/                          # Button, Card, Badge, ProgressBar, MetricCard, Modal, …
  lib/
    types.ts                     # all core entity & view-model types
    constants.ts                 # enums + UI style maps
    seed-data.ts                 # the seeded dataset
    db.ts                        # file-backed JSON store (.data/db.json)
    services.ts                  # business logic behind the API
    metrics.ts                   # fulfillment / health roll-ups
    extractor.ts                 # ContractExtractor abstraction + mock
    assistant.ts                 # AssistantEngine abstraction + rule engine
    api-client.ts                # typed client fetch wrapper
    agents/
      types.ts                   # provider-agnostic agent contracts
      system-prompt.ts           # platform prompt injected into every agent
      runtime.ts                 # the tool-calling loop
      workflows.ts               # named agent configurations
      request.ts                 # HTTP request validation
      store.ts                   # run persistence
      providers/                 # anthropic · openai · local (+ shared adapter)
      tools/                     # domain tools over the service layer
    storage/                     # Storage interface · s3 · local disk
scripts/
  seed.ts                        # reset/seed CLI
  smoke-agent.ts                 # end-to-end runtime test against a stub model
```

### Data model

`Team · Sponsor · Contract · Deliverable · Evidence · RecapReport` — all typed in
[`src/lib/types.ts`](src/lib/types.ts). Persistence is a single JSON file under `.data/`
(git-ignored, auto-created), and uploaded evidence files are stored in `.data/uploads/` and
served via `/api/files/[name]`. The repository-style access in `db.ts` makes swapping in
Postgres/Prisma a localized change.

---

## 🔌 API reference

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/dashboard` | Dashboard roll-up |
| `GET` | `/api/contracts` | List contracts (with stats) |
| `POST` | `/api/contracts` | Create a contract + deliverables |
| `GET` | `/api/contracts/:id` | Contract detail (deliverables + evidence) |
| `POST` | `/api/contracts/:id/recap` | Generate a recap report |
| `POST` | `/api/extract` | Extract deliverables from contract text |
| `GET` | `/api/deliverables` | List/filter deliverables |
| `PATCH` | `/api/deliverables/:id` | Update a deliverable (status, quantity, notes…) |
| `GET` `POST` | `/api/evidence` | List / upload evidence (multipart) |
| `POST` | `/api/assistant` | Ask the assistant a question |
| `GET` | `/api/sponsors` | List sponsors |
| `GET` | `/api/files/*` | Serve an uploaded file (redirects to a presigned URL on S3) |
| `POST` | `/api/reset` | Restore seed data |
| `GET` | `/api/agents` | Available providers, models, and workflows |
| `GET` `POST` | `/api/agents/runs` | List recent runs / start a run (blocking) |
| `GET` | `/api/agents/runs/:id` | One run with its full event log |
| `POST` | `/api/agents/runs/stream` | Start a run, stream events over SSE |
| `POST` | `/api/uploads` | Upload a run attachment (`?presign=1` for a direct S3 PUT) |

---

## 🎬 Suggested demo flow

1. **Dashboard** — note Pepsi flagged **critical** (a missed high-priority email + at-risk items).
2. **Contracts → Pepsi** — see deliverables grouped by category and the "needs attention" callout.
3. **Mark an at-risk item delivered** — watch the quantity auto-fill and fulfillment update.
4. **Upload contract** (`New contract`) — click **Load sample**, **Extract deliverables**
   (6 rows appear), tweak, and **Save**.
5. **Deliverables board** — filter by sponsor/category; drag-free status changes via the editor.
6. **Add evidence** to a deliverable from the board or contract page.
7. **Recap report** — open Pepsi's recap and **Print / Save as PDF**.
8. **Assistant** — ask _"What do we still owe Pepsi?"_ or _"Generate a renewal summary for Gatorade."_

---

## Notes & MVP scope

- **Auth** is mocked (single team, single user) — the shell shows the active team/user.
- **PDF parsing** is intentionally stubbed; paste text or upload `.txt` (the sample button is the
  fastest path). The extractor is structured to accept real parsed text unchanged.
- **File storage** is local (`.data/uploads/`) — fine for a demo, swappable for S3/blob later.
- Built with **Next.js 14 (App Router), TypeScript, Tailwind CSS**.
