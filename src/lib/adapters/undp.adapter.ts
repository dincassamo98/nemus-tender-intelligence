import * as cheerio from "cheerio";
import type { AdapterEvent, AdapterRunContext, SourceAdapter, RawAnnouncement } from "./types";
import { extractDates, extractDeadline, extractReferenceNumber } from "../pipeline/extract";

/**
 * UNDP Procurement Notices (procurement-notices.undp.org) — UNDP's global
 * procurement portal. Public, unauthenticated, and notices are tagged with
 * a country-scoped reference (e.g. "UNDP-MOZ-00643"), which is what this
 * adapter filters on rather than trusting an unverified query-string
 * filter.
 *
 * This is the representative first UN-family adapter (spec section 6/7:
 * "treat the UN ecosystem as a source family" — evaluate each agency,
 * don't build all of them speculatively). UNDP was chosen over the other
 * ~10 UN agencies researched because it scored highest on the evaluation
 * matrix: public + unauthenticated (high accessibility), consistently
 * publishes Mozambique-tagged environmental/climate consultancy notices
 * (high relevance — UNDP runs most of the country's climate-adaptation and
 * SDG-support portfolio), and a stable, scrapeable ColdFusion search page
 * (high automation feasibility). The remaining UN agencies (UNEP, UNOPS,
 * FAO, UNICEF, WFP, UN-Habitat, UNESCO, UNFPA, IOM, WHO, UN Women) are
 * documented as researched-but-deferred in registry.ts with the same
 * evaluation dimensions, to be built opportunistically once one proves out
 * a meaningful volume of Nemus-relevant notices.
 *
 * VALIDATION STATUS: this sandbox has no network egress to
 * procurement-notices.undp.org (confirmed blocked), so the real markup is
 * unverified.
 */

const SEARCH_URL = "https://procurement-notices.undp.org/search.cfm";
const REQUEST_TIMEOUT_MS = 20_000;
const USER_AGENT = "NemusTenderIntelligence/1.0 (+internal tool for Nemus Africa; contact: iris@nemus.africa)";
const COUNTRY_MARKERS = ["mozambique", "-moz-", "undp-moz"];

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

interface ParsedNotice {
  text: string;
  linkHref?: string;
}

function isMozambiqueRelevant(text: string): boolean {
  const lower = text.toLowerCase();
  return COUNTRY_MARKERS.some((m) => lower.includes(m));
}

function parseNotices(html: string): ParsedNotice[] {
  const $ = cheerio.load(html);
  const notices: ParsedNotice[] = [];

  $("table tr").each((_, tr) => {
    const text = $(tr).text().replace(/\s+/g, " ").trim();
    if (text.length < 20) return;
    notices.push({ text, linkHref: $(tr).find("a[href]").first().attr("href") });
  });

  if (notices.length === 0) {
    $("li, .notice, .result-row").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text.length < 20 || text.length > 2000) return;
      notices.push({ text, linkHref: $(el).find("a[href]").first().attr("href") });
    });
  }

  return notices;
}

function noticeToAnnouncement(notice: ParsedNotice): RawAnnouncement | null {
  if (notice.text.length < 15) return null;
  const reference = extractReferenceNumber(notice.text) ?? notice.text.match(/UNDP-[A-Z]{2,4}-\d+/)?.[0];
  const dates = extractDates(notice.text);
  const deadline = extractDeadline(notice.text) ?? dates[dates.length - 1];
  const announcementUrl = notice.linkHref ? new URL(notice.linkHref, SEARCH_URL).toString() : undefined;

  return {
    externalRef: reference,
    organizationRaw: "UNDP Mozambique",
    title: notice.text.slice(0, 200),
    description: notice.text,
    geography: "Moçambique",
    sourceUrl: SEARCH_URL,
    announcementUrl,
    deadline,
    submissionDeadline: deadline,
    procurementMethod: "UN Procurement",
    sourceDescription: `UNDP Procurement Notices — Mozambique (${SEARCH_URL})`,
  };
}

export const undpAdapter: SourceAdapter = {
  key: "undp",
  name: "UNDP Procurement Notices — Mozambique",
  requiresAuth: false,
  validationStatus: "NEEDS_VALIDATION",
  async *run(_ctx: AdapterRunContext): AsyncGenerator<AdapterEvent> {
    yield { type: "log", message: `Fetching ${SEARCH_URL}` };

    let html: string;
    try {
      html = await fetchHtml(SEARCH_URL);
    } catch (err) {
      yield {
        type: "error",
        fatal: true,
        message: `Failed to reach UNDP procurement notices (${err instanceof Error ? err.message : String(err)}).`,
      };
      return;
    }

    const allNotices = parseNotices(html);
    const mozNotices = allNotices.filter((n) => isMozambiqueRelevant(n.text) || (n.linkHref && isMozambiqueRelevant(n.linkHref)));
    yield {
      type: "log",
      message: `Parsed ${allNotices.length} notice row(s) globally; ${mozNotices.length} tagged as Mozambique-relevant.`,
    };

    if (allNotices.length === 0) {
      yield {
        type: "error",
        fatal: false,
        message: `No notice rows matched the expected structure at ${SEARCH_URL} — the page's markup may have changed, or results may load via a client-side search call this adapter can't see. Verify manually.`,
      };
      return;
    }

    let emitted = 0;
    for (const notice of mozNotices) {
      const announcement = noticeToAnnouncement(notice);
      if (announcement) {
        emitted++;
        yield { type: "announcement", announcement };
      }
    }
    yield { type: "log", message: `Extracted ${emitted} Mozambique-relevant announcement(s) from UNDP.` };
  },
};
