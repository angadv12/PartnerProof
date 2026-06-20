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
    api/                         # REST API (route handlers)
      contracts, contracts/[id], contracts/[id]/recap,
      deliverables, deliverables/[id], extract, evidence,
      assistant, dashboard, sponsors, files/[name], reset
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
scripts/seed.ts                  # reset/seed CLI
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
| `GET` | `/api/files/:name` | Serve an uploaded evidence file |
| `POST` | `/api/reset` | Restore seed data |

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
