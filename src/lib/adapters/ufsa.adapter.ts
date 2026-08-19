import * as cheerio from "cheerio";
import type { AdapterEvent, AdapterRunContext, SourceAdapter, RawAnnouncement } from "./types";
import { extractDates, extractDeadline, extractReferenceNumber, guessOrganization } from "../pipeline/extract";
import { looksLikeAnnouncement } from "../intelligence/discovery-keywords";

/**
 * UFSA (Unidade Funcional de Supervisão das Aquisições) publishes Mozambique's
 * open public procurement notices as plain server-rendered pages at
 * ufsa.gov.mz — a conventional government table listing, not an authenticated
 * flipbook. This is a good target for a lightweight HTTP + HTML-parsing
 * adapter (no browser automation needed), which is also why it runs fine
 * inside a Vercel serverless function when triggered by the Refresh button,
 * unlike the Playwright-based Jornal Notícias adapter.
 *
 * VALIDATION STATUS: this sandbox environment has no network egress to
 * ufsa.gov.mz (confirmed blocked), so the exact table markup could not be
 * inspected directly during development. The parser below is deliberately
 * generic — it doesn't assume specific CSS classes, only that open tenders
 * are rendered as an HTML <table> with one row per tender and that each row
 * contains a title/description cell, a reference-like token, and a date.
 * Run `pnpm ingest --source ufsa` against the real site and inspect the
 * SourceRun log before relying on this in production; if the table markup
 * doesn't match, the adapter fails loudly (a `type: "error"` event) rather
 * than silently returning zero results indistinguishable from "no tenders
 * today" — see the source health page.
 */

const UFSA_OPEN_TENDERS_URL = "https://www.ufsa.gov.mz/concursos.php";
const REQUEST_TIMEOUT_MS = 20_000;
const USER_AGENT =
  "NemusTenderIntelligence/1.0 (+internal tool for Nemus Africa; contact: iris@nemus.africa)";

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`UFSA responded with HTTP ${res.status} for ${url}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

interface ParsedRow {
  text: string;
  cells: string[];
  linkHref?: string;
}

function parseTenderTable(html: string): ParsedRow[] {
  const $ = cheerio.load(html);
  const rows: ParsedRow[] = [];

  // Generic strategy: every <table> on the page, every <tr> with 2+ <td>.
  // Government CMS table markup here is unverified (see module docstring),
  // so we don't key off a specific selector.
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

    const linkHref = $(tr).find("a[href]").first().attr("href");
    rows.push({ text, cells, linkHref });
  });

  return rows;
}

function rowToAnnouncement(row: ParsedRow, baseUrl: string): RawAnnouncement | null {
  const text = row.cells.join("\n");
  if (text.trim().length < 15) return null;

  // Heuristic: the longest cell is usually the title/description; a cell
  // matching a reference-number pattern is the tender reference.
  const titleCell = [...row.cells].sort((a, b) => b.length - a.length)[0];
  const reference = extractReferenceNumber(text);
  const dates = extractDates(text);
  const deadline = extractDeadline(text) ?? dates[dates.length - 1];
  const organization = guessOrganization(text);

  const announcementUrl = row.linkHref
    ? new URL(row.linkHref, baseUrl).toString()
    : undefined;

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
    sourceDescription: `UFSA — Portal de Concursos Públicos (${baseUrl})`,
    inferredFields: organization ? undefined : ["organizationRaw"],
  };
}

export const ufsaAdapter: SourceAdapter = {
  key: "ufsa",
  name: "UFSA — Portal de Concursos Públicos",
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

    const rows = parseTenderTable(html);
    yield { type: "log", message: `Parsed ${rows.length} candidate row(s) from the open-tenders table.` };

    if (rows.length === 0) {
      yield {
        type: "error",
        fatal: false,
        message:
          "No tender rows matched the expected table structure. This likely means UFSA changed its page markup rather than that zero tenders are open — verify manually at " +
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
