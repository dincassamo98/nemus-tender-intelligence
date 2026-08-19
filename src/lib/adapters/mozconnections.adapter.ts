import * as cheerio from "cheerio";
import type { AdapterEvent, AdapterRunContext, SourceAdapter, RawAnnouncement } from "./types";
import { extractDates, extractDeadline, extractReferenceNumber, guessOrganization } from "../pipeline/extract";
import { looksLikeAnnouncement } from "../intelligence/discovery-keywords";

/**
 * MozConnections — a Mozambican opportunities platform (tenders + jobs)
 * with a dedicated tenders subdomain:
 *
 *   https://concursos.mozconnections.co.mz/
 *
 * (an alternate path, https://mozconnections.co.mz/Concursoes/IndexPublic,
 * turned up in research too — its "IndexPublic" naming suggests a
 * server-rendered ASP.NET-MVC-style list page; kept here as a fallback URL
 * in case the subdomain redirects or is retired).
 *
 * VALIDATION STATUS: this sandbox has no network egress to
 * mozconnections.co.mz (confirmed blocked), so the real markup is
 * unverified. This adapter uses the same generic table/list-detection
 * strategy as the UFSA adapter (see that file for the reasoning) and fails
 * loudly rather than silently returning zero results if the structure
 * doesn't match.
 */

const PRIMARY_URL = "https://concursos.mozconnections.co.mz/";
const FALLBACK_URL = "https://mozconnections.co.mz/Concursoes/IndexPublic";
const REQUEST_TIMEOUT_MS = 20_000;
const USER_AGENT = "NemusTenderIntelligence/1.0 (+internal tool for Nemus Africa; contact: iris@nemus.africa)";

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" }, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

interface ParsedRow {
  text: string;
  linkHref?: string;
}

function parseRows(html: string): ParsedRow[] {
  const $ = cheerio.load(html);
  const rows: ParsedRow[] = [];

  $("table tr").each((_, tr) => {
    const text = $(tr).text().replace(/\s+/g, " ").trim();
    if (text.length < 20) return;
    if (!looksLikeAnnouncement(text) && !/\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4}/.test(text)) return;
    rows.push({ text, linkHref: $(tr).find("a[href]").first().attr("href") });
  });
  if (rows.length > 0) return rows;

  for (const selector of ["[class*='concurso' i]", "[class*='tender' i]", "[class*='card' i]", "li", "article"]) {
    const found: ParsedRow[] = [];
    $(selector).each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text.length < 20 || text.length > 2000) return;
      if (!looksLikeAnnouncement(text) && !/\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4}/.test(text)) return;
      found.push({ text, linkHref: $(el).find("a[href]").first().attr("href") });
    });
    if (found.length >= 2) return found;
  }

  return rows;
}

function rowToAnnouncement(row: ParsedRow, baseUrl: string): RawAnnouncement | null {
  if (row.text.length < 15) return null;
  const reference = extractReferenceNumber(row.text);
  const dates = extractDates(row.text);
  const deadline = extractDeadline(row.text) ?? dates[dates.length - 1];
  const organization = guessOrganization(row.text);
  const announcementUrl = row.linkHref ? new URL(row.linkHref, baseUrl).toString() : undefined;

  return {
    externalRef: reference,
    organizationRaw: organization ?? "Not extracted from listing text",
    title: row.text.slice(0, 200),
    description: row.text,
    sourceUrl: baseUrl,
    announcementUrl,
    deadline,
    submissionDeadline: deadline,
    sourceDescription: `MozConnections — Concursos (${baseUrl})`,
    inferredFields: organization ? undefined : ["organizationRaw"],
  };
}

export const mozConnectionsAdapter: SourceAdapter = {
  key: "mozconnections",
  name: "MozConnections — Concursos",
  requiresAuth: false,
  validationStatus: "NEEDS_VALIDATION",
  async *run(_ctx: AdapterRunContext): AsyncGenerator<AdapterEvent> {
    let html: string | null = null;
    let usedUrl = PRIMARY_URL;

    for (const url of [PRIMARY_URL, FALLBACK_URL]) {
      yield { type: "log", message: `Fetching ${url}` };
      try {
        html = await fetchHtml(url);
        usedUrl = url;
        break;
      } catch (err) {
        yield { type: "log", message: `${url} unreachable: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    if (!html) {
      yield { type: "error", fatal: true, message: "Failed to reach MozConnections at both the primary and fallback URLs." };
      return;
    }

    const rows = parseRows(html);
    yield { type: "log", message: `Parsed ${rows.length} candidate row(s) from MozConnections.` };

    if (rows.length === 0) {
      yield {
        type: "error",
        fatal: false,
        message: `No tender rows matched any expected structure at ${usedUrl} — the site's markup may have changed, or it may render results client-side via JavaScript (in which case this adapter needs to move to Playwright). Verify manually.`,
      };
      return;
    }

    let emitted = 0;
    for (const row of rows) {
      const announcement = rowToAnnouncement(row, usedUrl);
      if (announcement) {
        emitted++;
        yield { type: "announcement", announcement };
      }
    }
    yield { type: "log", message: `Extracted ${emitted} announcement(s) from MozConnections.` };
  },
};
