# Architecture

## What this is, and isn't

This is a Tender Intelligence platform, not a scraper. The north star:
maximize the probability that Nemus África discovers a relevant tender early
enough to submit a strong bid. That means recall matters more than precision
during discovery (a human dismissing a false positive costs seconds; a missed
opportunity can cost a contract), every extracted fact has to be traceable to
where it came from, and the system has to fail loudly, never silently.

## Research findings that shaped the design

**Jornal Notícias (`flipbook-snoticias.app.co.mz`)**: an authenticated
digital-edition reader, part of the "Sociedade do Notícias" family of apps
(shared with Jornal Domingo, Jornal Desafio), built on a generic flipbook
engine ("Logica Software", also behind their Play Store/App Store apps).
Two facts materially shaped the ingestion design:

1. **The platform itself keeps no back-catalogue** — its own terms state
   editions become available the day after publication and past editions are
   not offered. This means the platform cannot be treated as a queryable
   archive; **we have to become the archive** by capturing each edition once
   and persisting it permanently (`Edition` + `TenderVersion` rows,
   raw documents on disk/object storage). A lookback window is only useful
   for catching up after downtime, not for historical research.
2. **This sandbox's network egress is blocked for the real domain** (and for
   `ufsa.gov.mz`, `nemus.pt`, `goconcurso.com` — confirmed via both the
   WebFetch tool and raw `curl`). The Jornal Notícias and UFSA adapters were
   therefore built from public research (App Store listings, terms pages,
   search results) rather than live DOM inspection, and are marked
   `validationStatus: "NEEDS_VALIDATION"` in `src/lib/adapters/types.ts` — see
   "Known gaps" below. This is not a corner cut silently; the Sources page
   surfaces this status, and every selector is overridable via
   `Source.config` so a maintainer can fix drift without a redeploy.

**UFSA** (`ufsa.gov.mz`): the official Mozambican public procurement
supervision unit. `concursos.php` / `concursos_encerrados.php` are plain,
unauthenticated, server-rendered government pages — a much better fit for a
lightweight HTTP + HTML-parsing adapter than for browser automation, which is
also why it can run inline inside a Vercel function.

**Nemus África**: part of the international Nemus consultancy (HQ Portugal,
active in 14 countries). Nemus África, established 2016 and headquartered in
Maputo, works across three core domains — Environment, Progress & Public
Policies, Sustainability — with a track record in Environmental & Social
Impact Assessment, Strategic Environmental Assessment, cumulative impact
assessment for transport ministries (Mozambique, Malawi), municipal
pollution-control programmes, and donor-funded forest-carbon/REDD+ work. This
directly informs `src/lib/intelligence/nemus-profile.ts`, the structured
input to the relevance classifier — see below.

**Sources added after user feedback identified real, currently-used
sources**: Diário Económico (`diarioeconomico.co.mz/category/concursos-publicos/`
— a WordPress site; the adapter tries the WP REST API first, falls back to
HTML), MozConnections (`concursos.mozconnections.co.mz`), and UNDP
Procurement Notices (`procurement-notices.undp.org`, filtered to
Mozambique-tagged notices) — the first of the UN-agency family, chosen over
the other ~10 UN agencies researched via the evaluation matrix in
`registry.ts`. The UFSA adapter's URL was also corrected to the current
"DotCom" platform (`ufsa.dotcom.co.mz/concursos?status=OPEN`) after the
originally-researched `ufsa.gov.mz` proved to be a superseded version. All
three, like Jornal Notícias and UFSA, are `NEEDS_VALIDATION` and disabled by
default pending a live run.

**Other procurement sources researched** (World Bank Projects & Operations,
AfDB, UNGM, FAO, UNOPS, GoConcurso, concursos.co.mz, ministry/municipality
sites): evaluated but not built — see the documented rationale in
`src/lib/adapters/registry.ts` (`RESEARCHED_UNIMPLEMENTED_SOURCES` and the
UN agency evaluation matrix). World Bank remains the recommended next build:
non-authenticated, structured, and squarely in Nemus's target sector.

## Why ingestion is split across Vercel and GitHub Actions

The app deploys to Vercel + managed Postgres (Supabase/Neon), per the
project's stated deployment target. Vercel serverless functions have hard
execution-time limits and no support for long-running headless-browser
sessions — incompatible with the Jornal Notícias adapter's Playwright-driven
login → edition-by-edition → page-by-page walk, which can run for minutes.

So:
- **Lightweight, non-authenticated sources** (currently UFSA; future
  World Bank/AfDB) run inline — either from the in-app **Refresh** button
  (`POST /api/ingestion/trigger`) or from a Vercel Cron job
  (`vercel.json` → `GET /api/cron/lightweight`, protected by `CRON_SECRET`).
- **Browser-automation sources** (Jornal Notícias) run only via
  `.github/workflows/ingest.yml`, a scheduled GitHub Actions job with a real
  Node + Playwright environment and no serverless time limit, writing
  directly to the same Postgres database via Prisma. Clicking Refresh for
  this source dispatches that workflow (`workflow_dispatch` via the GitHub
  API, using `GITHUB_DISPATCH_TOKEN`) rather than trying to run it in-process
  — if that token isn't configured, the UI says so explicitly instead of
  pretending the click did something.

Both paths go through the exact same pipeline (`src/lib/pipeline/run.ts`) and
adapter contract, so this is a deployment-topology decision, not a
duplicated-logic one.

## Source adapter architecture

Every source implements `SourceAdapter` (`src/lib/adapters/types.ts`): an
async generator yielding `log` / `edition_discovered` / `announcement` /
`error` events. The orchestrator (`runSourceIngestion` in
`src/lib/pipeline/run.ts`) doesn't know or care whether a source is a
Playwright flipbook or a `fetch()` + Cheerio table scrape — it consumes the
same event stream, persists `SourceRun` progress/log entries as it goes (so
the Refresh UI is never left wondering if anything is happening), and updates
`Source.reliabilityScore` / `lastErrorMessage` after every run. Adding a
source is: implement the interface, register it in
`src/lib/adapters/registry.ts`, add a `Source` row. See
`docs/ADDING_A_SOURCE.md`.

## The ingestion pipeline

```
adapter.run() → dedupe check → new: classify + summarize + persist
                              → update: detect changes + version + persist
                              → duplicate: increment counter, no write
```

Each stage is a small, pure(ish), independently unit-tested module:
- `lib/pipeline/extract.ts` — date/deadline/reference-number/organization
  extraction from free text (used by both text-parsing adapters).
- `lib/pipeline/dedupe.ts` — reference-number match → URL match → document
  hash match → fuzzy org+title match (Sørensen–Dice over bigrams); never
  URL equality alone (spec requirement).
- `lib/pipeline/changes.ts` — snapshot diffing for deadlines, values, and
  requirement lists, producing human-readable change descriptions.
- `lib/pipeline/documents.ts` — download, hash, store, extract text (PDF via
  `pdf-parse`, OCR fallback via `tesseract.js` for images / text-less PDFs).
- `lib/intelligence/classifier.ts` — relevance scoring (below).
- `lib/intelligence/summary.ts` — executive summary + PURSUE/REVIEW/
  LOW_PRIORITY recommendation, deterministically derived from stored fields.

## The relevance classifier

Rule-based v1, deliberately not a black box: every score comes with
human-readable `reasons`, grounded in `lib/intelligence/nemus-profile.ts` — a
structured (and honestly editable) representation of Nemus África's mission,
service areas, weighted keywords (PT + EN), preferred client types, and
geographic focus, built from the research above.

Design choices worth knowing:
- **Domain-area keyword matches** (EIA, climate, biodiversity, water,
  sustainability, etc.) drive most of the score, weighted per area.
- **Generic procurement-process language alone** ("concurso público",
  "consultoria", RFP boilerplate) is capped at a low score even if matched —
  it's what makes an item *discoverable*, not what makes it *relevant*. This
  is the recall/precision split in code: cast a wide net at discovery
  (`lib/intelligence/discovery-keywords.ts`), then let the classifier decide
  how loudly to flag it.
- **Geography and known client-type bonuses** are additive, not gating — an
  unlabeled-geography tender still gets scored on content.
- Thresholds (`CLASSIFICATION_THRESHOLDS`) and deadline urgency thresholds
  (`DEFAULT_URGENCY_THRESHOLDS`) are single exported constants, not scattered
  magic numbers — see them surfaced (read-only) on the Settings page.
- **Extension point, not a dead end**: `RelevanceClassifier` is an interface;
  `getClassifier()` is where a future semantic/embeddings or LLM-backed
  implementation plugs in without touching the pipeline or UI. `HumanFeedback`
  rows (relevant/not relevant/pursue/ignore/score correction, captured from
  the tender detail page) are recorded now specifically so that future
  classifier has real labeled data on day one.

Known limitation: because organization names are included in the text the
classifier scans, a tender from an environmentally-named department (e.g. a
"Direcção de Recursos Hídricos") can score higher than its actual subject
matter warrants even for unrelated procurement (school construction, office
supplies). Acceptable for a recall-favoring v1 — a human reviews before
pursuing — but worth tightening if it proves noisy in practice (e.g. weight
organization-name matches lower than description matches).

## Data model

See `prisma/schema.prisma`. Highlights beyond the obvious `Tender` record:
- `TenderFieldProvenance` — every extracted fact is tagged `CONFIRMED`
  (from the source), `INFERRED` (derived by extraction heuristics), or
  `AI_GENERATED` (classifier/summary output), with a human-readable source
  description ("Jornal Notícias — Edição 18 Ago 2026 — Página 14"). The UI
  never presents an AI-generated fact as if it were directly sourced.
- `TenderVersion` / `TenderChange` — full-snapshot version history plus a
  diffed, human-readable change log (deadline moved, requirement added...).
- `HumanFeedback` — the classifier's future training signal, surfaced
  (never auto-applied) in the Settings "learning from feedback" panel.
- `SourceRun` — per-run counters and an ordered log array, which is exactly
  what the Refresh UI renders.
- `TenderSourceSighting` — cross-source intelligence: when a second source
  reports what the dedupe engine determines is the same real-world
  opportunity, it's linked here rather than creating a second `Tender` row,
  so the UI can show "1 opportunity — discovered across N sources" with
  each source as independent corroborating evidence, instead of N
  disconnected listings.

## Canonical procurement taxonomy

Different sources never agree on terminology (a UN agency's "Request for
Proposal" vs. a ministry's "Pedido de Manifestação de Interesse" vs. a
newspaper's "Anúncio de Concurso"). `lib/intelligence/taxonomy.ts` maps all
of these onto one canonical set of opportunity types, so relevance never
hinges on a source happening to use the word "concurso". The same module
also does OCR-tolerant fuzzy matching of Jornal Notícias' two priority
section headers ("Pedido de Manifestação de Interesse", "Anúncio de
Concurso") — the newspaper adapter treats content found there as
higher-trust than a generic keyword hit, per the two-layer strategy
(section detection + keyword fallback) described in that adapter's file.

## Rendering model

Standard Next.js dynamic rendering (no Cache Components / PPR) — this is an
authenticated, constantly-changing operational dashboard, not a page that
benefits from a static shell. Every data-bearing route is explicitly
`export const dynamic = "force-dynamic"` (or implicitly dynamic via
`searchParams`/route params) so nothing is ever accidentally baked in at
build time.

## Known gaps (deliberate, tracked, not hidden)

- **Jornal Notícias and UFSA adapters need live validation.** Built from
  research, not live DOM inspection (network egress blocked in this
  environment — see above). Run `pnpm ingest --source ufsa` /
  `--source jornal-noticias` against the real sites before enabling them in
  production (`Source.enabled` defaults to `false` for both).
- **Scanned-PDF OCR is not wired end-to-end.** `documents.ts` OCRs images and
  falls back for PDFs with no extractable text layer only via a stub that
  currently returns nothing — rasterizing PDF pages to images needs a native
  canvas dependency not worth adding until a real scanned-PDF case from a
  live source proves it's needed. Text-layer PDFs (the common case) are
  unaffected.
- **Local file storage is ephemeral on Vercel and GitHub Actions runners.**
  `STORAGE_DRIVER=local` is fine for a persistent server/VPS or local dev;
  extracted *text* always lands in Postgres regardless, but the original raw
  file itself won't survive a serverless/CI run. Implement an S3-compatible
  `StorageDriver` (`src/lib/storage/index.ts`) before relying on raw-document
  retention in that topology.
- **Brand/design system is a placeholder.** `nemus.pt` was unreachable from
  this environment; the palette in `globals.css` is a professional
  environmental-consultancy placeholder, not Nemus's real brand. Swapping it
  is a CSS-variable change, not a rewrite.
- **Cross-source semantic dedupe** currently relies on reference number, URL,
  document hash, and fuzzy title/org matching — no embeddings-based semantic
  similarity yet. Flagged as a natural pairing with the classifier's future
  semantic upgrade.

## What's deliberately out of scope for this MVP (P1/P2)

Per the spec's own prioritization: automated notifications (email/digest),
scheduled multi-times-a-day cadence beyond what's configured, Gmail/Outlook
send integration (the email panel generates + lets you copy/open in your mail
client, grounded strictly in stored fields — it does not send), full-text/
semantic search, "similar opportunity" ML recommendations beyond the simple
organization/category-tag match already in the tender detail page, and
business-value analytics (win rate, pipeline value). The data model already
has the shape for most of these (`Notification`, `EmailDraft.sentAt`,
`HumanFeedback`) so they're additive work, not a redesign.
