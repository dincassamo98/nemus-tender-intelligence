# Adding a new procurement source

A new source should never require touching the pipeline, the database
layer, or the UI. Five steps:

## 1. Evaluate it first

Before writing code, answer (and write down somewhere, e.g. as a code
comment near your adapter — see `src/lib/adapters/registry.ts` for the
pattern used for researched-but-unbuilt sources):

- **Relevance**: does it plausibly carry environmental/sustainability/
  consulting opportunities relevant to Nemus África, or general Mozambican
  public procurement?
- **Reliability**: is it a stable, official/authoritative publisher, or
  something that might vanish or change format without notice?
- **Accessibility**: does it have a public page/API you can legally and
  technically automate against? Check for a robots.txt, terms of use, rate
  limits, and whether it requires authentication.
- **Automation feasibility**: plain HTML table → lightweight adapter
  (`fetch` + `cheerio`, can run inline on Vercel). JS-rendered / requires a
  browser session → Playwright adapter (must run via the GitHub Actions
  worker or `pnpm ingest`, not inline on Vercel — see
  `docs/ARCHITECTURE.md`).
- **Publication frequency**: how often should it realistically be checked?
  Don't poll faster than the source actually publishes.

## 2. Implement `SourceAdapter`

Create `src/lib/adapters/<your-source>.adapter.ts` implementing the
interface in `src/lib/adapters/types.ts`:

```ts
export const yourSourceAdapter: SourceAdapter = {
  key: "your-source",                 // must match Source.adapterKey in the DB
  name: "Human-readable name",
  requiresAuth: false,
  validationStatus: "NEEDS_VALIDATION", // flip to "VALIDATED" only after a real run
  async *run(ctx) {
    yield { type: "log", message: "Starting…" };
    // ... discover announcements ...
    yield { type: "announcement", announcement: { /* RawAnnouncement */ } };
  },
};
```

Guidelines learned from the two real adapters already in the codebase:

- **Fail loudly, not silently.** If your source's page structure doesn't
  match what you expect (e.g. an empty table where you expected rows), yield
  a `type: "error"` event explaining that — never let "found nothing" be
  indistinguishable from "the scraper is broken". This is what makes the
  Sources health page trustworthy.
- **Prefer structured data over scraping** when the source offers it (an
  API, RSS, downloadable CSV/JSON). Only fall back to HTML/OCR parsing when
  nothing structured exists.
- **Every `RawAnnouncement` needs a `sourceDescription`** — a human-readable
  citation ("UFSA — Portal de Concursos Públicos", "Jornal Notícias — Edição
  18 Ago 2026 — Página 14") shown verbatim in the tender detail page's
  provenance panel. Never fabricate a field you're not confident about; mark
  it in `inferredFields` instead of guessing silently.
- **Be a polite subscriber, not a scraper hammering a server**: reasonable
  timeouts, a real `User-Agent`, and (for browser automation) small waits
  between page navigations.
- Reuse `src/lib/pipeline/extract.ts` (dates, deadlines, reference numbers,
  organization guessing) and `src/lib/intelligence/discovery-keywords.ts`
  (broad recall-favoring keyword filter) rather than re-implementing them.

## 3. Register it

Add one line to `ADAPTER_REGISTRY` in `src/lib/adapters/registry.ts`.

## 4. Add a `Source` row

Either via `prisma/seed.ts` (for a source everyone should have) or directly
in the database. Leave `enabled: false` until you've run
`pnpm ingest --source your-source` against the live site and are satisfied
with extraction quality — then flip both `enabled: true` and the adapter's
`validationStatus` to `"VALIDATED"`.

## 5. If it needs browser automation

Add its `key` to `BROWSER_AUTOMATION_ADAPTER_KEYS` in
`src/lib/adapters/registry.ts` so the Refresh button dispatches it to the
GitHub Actions worker instead of trying (and failing) to run Playwright
inline on Vercel, and confirm it's covered by
`.github/workflows/ingest.yml`'s schedule.

## Testing

Add unit tests for any new text-extraction logic (see `tests/extract.test.ts`
for the pattern) — extraction bugs are the kind that fail silently and
quietly cost a missed tender, so they're worth the coverage.
