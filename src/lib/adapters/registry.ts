import type { SourceAdapter } from "./types";
import { ufsaAdapter } from "./ufsa.adapter";
import { jornalNoticiasAdapter } from "./jornal-noticias.adapter";
import { diarioEconomicoAdapter } from "./diario-economico.adapter";
import { mozConnectionsAdapter } from "./mozconnections.adapter";
import { undpAdapter } from "./undp.adapter";

/**
 * The Source Registry. Every implemented adapter is registered here by key;
 * lib/pipeline/run.ts looks adapters up by Source.adapterKey from the
 * database, so adding a new source is: (1) implement SourceAdapter, (2)
 * register it here, (3) insert a Source row (or add it to
 * prisma/seed-sources.ts). No other code changes. See docs/ADDING_A_SOURCE.md.
 *
 * No demo/mock adapter exists here on purpose — every registered source
 * hits a real endpoint. An empty result is a real empty result, never a
 * fabricated one.
 */
export const ADAPTER_REGISTRY: Record<string, SourceAdapter> = {
  [ufsaAdapter.key]: ufsaAdapter,
  [jornalNoticiasAdapter.key]: jornalNoticiasAdapter,
  [diarioEconomicoAdapter.key]: diarioEconomicoAdapter,
  [mozConnectionsAdapter.key]: mozConnectionsAdapter,
  [undpAdapter.key]: undpAdapter,
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
 * UN agency evaluation matrix (spec: "treat the UN ecosystem as a source
 * family... create a source-priority model"). UNDP was built first (see
 * undp.adapter.ts) because it scored highest across every dimension. The
 * rest are documented here rather than built speculatively — each should
 * be re-evaluated (and promoted to a real adapter) once UNDP's real-world
 * notice volume/relevance is confirmed, or sooner if Iris specifically
 * flags one as a source she already checks.
 *
 * | Agency    | Mozambique relevance | Environmental relevance | Frequency | Accessibility | Automation feasibility | Priority |
 * |-----------|----------------------|--------------------------|-----------|----------------|--------------------------|----------|
 * | UNDP      | High                 | High                      | High      | High (public)  | High                     | P0 (built)|
 * | UNEP      | Medium               | High                      | Low       | Medium         | Medium                   | P1       |
 * | FAO       | High                 | High (agri/land/forestry) | Medium    | Medium         | Medium                   | P1       |
 * | UNOPS     | Medium               | Medium                    | Medium    | High (public)  | High                     | P1       |
 * | WFP       | Medium               | Low-Medium                | Medium    | Medium         | Medium                   | P2       |
 * | UNICEF    | Medium               | Low                       | Medium    | Medium         | Medium                   | P2       |
 * | UN-Habitat| Medium               | Medium (urban/land)       | Low       | Low            | Low                      | P2       |
 * | UNESCO    | Low                  | Low                       | Low       | Low            | Low                      | P2       |
 * | UNFPA     | Low                  | Low                       | Low       | Low            | Low                      | P2       |
 * | IOM       | Low-Medium           | Low                       | Low       | Low            | Low                      | P2       |
 * | WHO       | Low                  | Low                       | Low       | Low            | Low                      | P2       |
 * | UN Women  | Low                  | Low                       | Low       | Low            | Low                      | P2       |
 *
 * UNGM (UN Global Marketplace, ungm.org) would in principle be a better
 * single integration point than agency-by-agency scraping — it aggregates
 * notices across the whole UN system — but requires a free registration
 * to see full listings, so it needs a one-time manual account-setup step
 * before it can be automated. Worth revisiting as a replacement for
 * several of the P1/P2 agency adapters above rather than building them
 * individually.
 */
export const UN_SOURCE_EVALUATION_NOTE =
  "See the comment block above UN_SOURCE_EVALUATION_NOTE in this file for the full agency-by-agency evaluation matrix.";

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
 *    África's target sector), high reliability expected.
 *  - African Development Bank (AfDB) procurement notices: similar profile to
 *    World Bank; Mozambique + regional (SADC) coverage. P1 candidate.
 *  - UNGM (UN Global Marketplace): see UN_SOURCE_EVALUATION_NOTE above —
 *    would consolidate most of the UN agency long-tail into one adapter,
 *    but needs a one-time registration step first.
 *  - UNEP, FAO, UNOPS, WFP, UNICEF, UN-Habitat, UNESCO, UNFPA, IOM, WHO,
 *    UN Women: evaluated individually, see the matrix above. FAO and UNOPS
 *    are the next-best UN candidates after UNDP.
 *  - GoConcurso (goconcurso.com) and Portal dos Concursos Públicos
 *    Moçambicanos (concursos.co.mz): private Mozambican tender aggregators
 *    that would in principle cover several of the sources above in one
 *    place. Potentially valuable as a cross-check source, but both are
 *    commercial products whose terms of use/scraping policy were not
 *    verifiable from this sandbox (network egress blocked) — do not build
 *    against either without first confirming their terms permit automated
 *    access, ideally by asking whether Nemus already has or could get a
 *    data-sharing/API arrangement.
 *  - Ministry/municipality websites: highly fragmented, inconsistent
 *    publishing cadence and formats; treat as one-off adapters added
 *    opportunistically once a specific ministry proves to publish
 *    Nemus-relevant work regularly (see Organization intelligence in
 *    docs/ARCHITECTURE.md "Future: recurring buyers").
 */
export const RESEARCHED_UNIMPLEMENTED_SOURCES = [
  "world-bank-projects-operations",
  "afdb-procurement",
  "ungm (requires one-time registration)",
  "fao-procurement",
  "unops-procurement",
  "goconcurso (requires ToS verification first)",
  "concursos.co.mz (requires ToS verification first)",
] as const;
