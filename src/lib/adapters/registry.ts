import type { SourceAdapter } from "./types";
import { demoAdapter } from "./demo.adapter";
import { ufsaAdapter } from "./ufsa.adapter";
import { jornalNoticiasAdapter } from "./jornal-noticias.adapter";

/**
 * The Source Registry. Every implemented adapter is registered here by key;
 * lib/pipeline/run.ts looks adapters up by Source.adapterKey from the
 * database, so adding a new source is: (1) implement SourceAdapter, (2)
 * register it here, (3) insert a Source row (or add it to
 * prisma/seed-sources.ts). No other code changes. See docs/ADDING_A_SOURCE.md.
 */
export const ADAPTER_REGISTRY: Record<string, SourceAdapter> = {
  [demoAdapter.key]: demoAdapter,
  [ufsaAdapter.key]: ufsaAdapter,
  [jornalNoticiasAdapter.key]: jornalNoticiasAdapter,
};

export function getAdapter(adapterKey: string): SourceAdapter | undefined {
  return ADAPTER_REGISTRY[adapterKey];
}

/**
 * Adapters that need a real browser (Playwright) and therefore cannot run
 * inside a Vercel serverless function — they only run via the scheduled
 * GitHub Actions worker or a local `pnpm ingest`. Shared by the Refresh
 * button's trigger route and the lightweight Vercel Cron route so both
 * agree on which sources they may run inline.
 */
export const BROWSER_AUTOMATION_ADAPTER_KEYS = new Set(["jornal-noticias"]);

/**
 * P1/P2 candidate sources researched but not yet implemented, kept here as a
 * documented evaluation rather than silently forgotten. Each was assessed on
 * relevance, reliability/accessibility, and whether automation is realistic
 * before deciding to build it (spec section 9) — none were added blindly.
 *
 *  - World Bank Projects & Operations (projects.worldbank.org): publishes
 *    structured procurement notices per project, including Mozambique
 *    climate/environment-financed projects. Has a browsable, non-authenticated
 *    notice list and likely a stable URL/API pattern — good P1 candidate,
 *    high relevance (donor-funded environmental work is squarely in Nemus
 *    África's target sector), high reliability expected. Recommended next
 *    source to build after UFSA is validated.
 *  - African Development Bank (AfDB) procurement notices: similar profile to
 *    World Bank; Mozambique + regional (SADC) coverage. P1 candidate.
 *  - UNDP/UN agencies procurement (e.g. UNGM — UN Global Marketplace):
 *    aggregates notices across UN agencies, some Mozambique-specific. P1
 *    candidate; UNGM requires a free registration to see full notices, so
 *    accessibility needs a one-time manual setup step, not full automation.
 *  - GoConcurso (goconcurso.com): a private Mozambican tender aggregator.
 *    Potentially valuable as a cross-check source, but it's a commercial
 *    product whose terms of use/scraping policy were not verifiable from
 *    this sandbox (network egress blocked) — do not build against it without
 *    first confirming its terms permit automated access, ideally by asking
 *    whether Nemus already has or could get a data-sharing/API arrangement.
 *  - Ministry/municipality websites: highly fragmented, inconsistent
 *    publishing cadence and formats; treat as one-off adapters added
 *    opportunistically once a specific ministry proves to publish
 *    Nemus-relevant work regularly (see Organization intelligence in
 *    docs/ARCHITECTURE.md "Future: recurring buyers").
 */
export const RESEARCHED_UNIMPLEMENTED_SOURCES = [
  "world-bank-projects-operations",
  "afdb-procurement",
  "ungm",
  "goconcurso (requires ToS verification first)",
] as const;
