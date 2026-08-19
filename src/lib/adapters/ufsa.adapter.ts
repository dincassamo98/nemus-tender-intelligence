import * as cheerio from "cheerio";
import type { AdapterEvent, AdapterRunContext, SourceAdapter, RawAnnouncement } from "./types";
import { extractDates, extractDeadline, extractReferenceNumber, guessOrganization } from "../pipeline/extract";
import { looksLikeAnnouncement } from "../intelligence/discovery-keywords";

/**
 * UFSA (Unidade Funcional de Supervisão das Aquisições) — Mozambique's
 * public procurement supervision unit. The current portal
 * (ufsa.dotcom.co.mz, a "DotCom" platform product — the older ufsa.gov.mz
 * classic pages appear to be a previous/parallel version) exposes an
 * open-tenders view filtered server-side via a query string:
 *
 *   https://ufsa.dotcom.co.mz/concursos?status=OPEN
 *
 * This is a plain unauthenticated URL, a good fit for a lightweight
 * HTTP + HTML-parsing adapter (runs inline on Vercel, unlike Jornal
 * Notícias). It also means once "closed" listings prove useful for
 * organization-pattern intelligence (spec: recurring buyers), the same
 * adapter can be pointed at ?status=CLOSED with a second Source config.
 *
 * VALIDATION STATUS: this sandbox has no network egress to ufsa.dotcom.co.mz
 * (confirmed blocked), so the real markup is still unverified. Two real
 * possibilities exist for a modern "DotCom"-branded platform, and this
 * adapter is written to diagnose which one it actually is rather than
 * silently guessing:
 *   (a) server-rendered HTML with a table/list of tenders — the generic
 *       parser below handles this.
 *   (b) a client-side-rendered single-page app where the initial HTML is
 *       an near-empty shell and the real data loads via a JS API call this
 *       adapter can't see — detected via isLikelySpaShell() below, which
 *       raises a clear, actionable error instead of quietly returning zero
 *       results indistinguishable from "no open tenders today". If that
 *       fires on a real run, this adapter needs to be rebuilt on Playwright
 *       like the Jornal Notícias adapter, and the actual JSON API it calls
 *       (visible in the browser's network tab) should be used directly
 *       instead of scraping rendered HTML at all — Prefer structured
 *       data/API over brittle browser scraping wherever the source exposes
 *       one (spec section 4).
 */

const UFSA_OPEN_TENDERS_URL = "https://ufsa.dotcom.co.mz/concursos?status=OPEN";
const REQUEST_TIMEOUT_MS = 20_000;
const USER_AGENT = "NemusTenderIntelligence/1.0 (+internal tool for Nemus Africa; contact: iris@nemus.africa)";

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`UFSA responded with HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

/** Heuristic: a JS-rendered SPA shell has almost no text content and a tiny handful of root-level elements. */
function isLikelySpaShell($: cheerio.CheerioAPI): boolean {
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const scriptCount = $("script[src]").length;
  return bodyText.length < 200 && scriptCount > 0;
}

interface ParsedRow {
  text: string;
  cells: string[];
  linkHref?: string;
}

function parseTenderRows(html: string): { rows: ParsedRow[]; spaShellSuspected: boolean } {
  const $ = cheerio.load(html);
  const rows: ParsedRow[] = [];

  if (isLikelySpaShell($)) {
    return { rows: [], spaShellSuspected: true };
  }

  // Strategy A: conventional <table> rows.
  $("table tr").each((_, tr) => {
    const cells: string[] = [];
    $(tr)
      .find("td")
      .each((__, td) => {
        cells.push($(td).text().replace(/\s+/g, " ").trim());
      });
    if (cells.length < 2) return;
    const text = cells.join(" | ");
    if (!looksLikeAnnouncement(text) && !/\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4}/.test(text)) return;
    rows.push({ text, cells, linkHref: $(tr).find("a[href]").first().attr("href") });
  });

  if (rows.length > 0) return { rows, spaShellSuspected: false };

  // Strategy B: modern portals often render each tender as a card/list item
  // rather than a table row. Look for repeated sibling blocks whose class
  // hints at that (tender/concurso/card/item/list), generic on purpose
  // since the exact class names are unverified.
  const candidateSelectors = [
    "[class*='concurso' i]",
    "[class*='tender' i]",
    "[class*='card' i]",
    "[class*='list-item' i]",
    "li",
  ];
  for (const selector of candidateSelectors) {
    const found: ParsedRow[] = [];
    $(selector).each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text.length < 20 || text.length > 2000) return;
      if (!looksLikeAnnouncement(text) && !/\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4}/.test(text)) return;
      found.push({ text, cells: [text], linkHref: $(el).find("a[href]").first().attr("href") });
    });
    if (found.length >= 2) {
      rows.push(...found);
      break;
    }
  }

  return { rows, spaShellSuspected: false };
}

function rowToAnnouncement(row: ParsedRow, baseUrl: string): RawAnnouncement | null {
  const text = row.cells.join("\n");
  if (text.trim().length < 15) return null;

  const titleCell = [...row.cells].sort((a, b) => b.length - a.length)[0];
  const reference = extractReferenceNumber(text);
  const dates = extractDates(text);
  const deadline = extractDeadline(text) ?? dates[dates.length - 1];
  const organization = guessOrganization(text);
  const announcementUrl = row.linkHref ? new URL(row.linkHref, baseUrl).toString() : undefined;

  return {
    externalRef: reference,
    organizationRaw: organization ?? "Unidade Gestora Executora das Aquisições (UGEA) — not extracted",
    title: titleCell.length > 200 ? titleCell.slice(0, 200) : titleCell,
    description: text,
    sourceUrl: baseUrl,
    announcementUrl,
    deadline,
    submissionDeadline: deadline,
    procurementMethod: /limitado/i.test(text) ? "Concurso Limitado" : "Concurso Público",
    sourceDescription: `UFSA — Portal de Concursos Públicos, filtro "Abertos" (${baseUrl})`,
    inferredFields: organization ? undefined : ["organizationRaw"],
  };
}

export const ufsaAdapter: SourceAdapter = {
  key: "ufsa",
  name: "UFSA — Portal de Concursos Públicos (abertos)",
  requiresAuth: false,
  validationStatus: "NEEDS_VALIDATION",
  async *run(_ctx: AdapterRunContext): AsyncGenerator<AdapterEvent> {
    yield { type: "log", message: `Fetching ${UFSA_OPEN_TENDERS_URL}` };

    let html: string;
    try {
      html = await fetchHtml(UFSA_OPEN_TENDERS_URL);
    } catch (err) {
      yield {
        type: "error",
        fatal: true,
        message: `Failed to reach UFSA (${err instanceof Error ? err.message : String(err)}). The site may be down, blocking automated requests, or its URL has changed — check manually before assuming there are simply no open tenders.`,
      };
      return;
    }

    const { rows, spaShellSuspected } = parseTenderRows(html);

    if (spaShellSuspected) {
      yield {
        type: "error",
        fatal: true,
        message:
          "The response looks like an empty JavaScript-app shell, not rendered content — this page likely loads tenders via a JS API call this HTTP-only adapter can't see. Needs to be rebuilt on Playwright (like the Jornal Notícias adapter) or, better, pointed directly at whatever JSON API the browser calls (inspect the Network tab on the real site). See the adapter's module docstring.",
      };
      return;
    }

    yield { type: "log", message: `Parsed ${rows.length} candidate row(s) from the open-tenders view.` };

    if (rows.length === 0) {
      yield {
        type: "error",
        fatal: false,
        message:
          "No tender rows matched any expected structure (table or card list). This likely means UFSA changed its page markup rather than that zero tenders are open — verify manually at " +
          UFSA_OPEN_TENDERS_URL,
      };
      return;
    }

    let emitted = 0;
    for (const row of rows) {
      const announcement = rowToAnnouncement(row, UFSA_OPEN_TENDERS_URL);
      if (announcement) {
        emitted++;
        yield { type: "announcement", announcement };
      }
    }
    yield { type: "log", message: `Extracted ${emitted} announcement(s) from UFSA.` };
  },
};
