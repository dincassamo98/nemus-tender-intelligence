import * as cheerio from "cheerio";
import type { AdapterEvent, AdapterRunContext, SourceAdapter, RawDocument } from "./types";
import { extractDeadline, extractReferenceNumber, guessOrganization } from "../pipeline/extract";

/**
 * Diário Económico — Mozambican business/economy publication with a
 * dedicated public-tenders category:
 *
 *   https://www.diarioeconomico.co.mz/category/concursos-publicos/
 *
 * The URL structure (/YYYY/MM/DD/concursos-publicos/post-slug/) is a
 * standard WordPress permalink pattern, so this adapter tries the
 * WordPress REST API first (structured JSON — no HTML parsing needed,
 * per spec section 4's "prefer structured data/API over brittle browser
 * scraping"), and only falls back to scraping the rendered category page
 * if the REST API is disabled (common on hardened WP installs) or
 * responds unexpectedly.
 *
 * VALIDATION STATUS: this sandbox has no network egress to
 * diarioeconomico.co.mz (confirmed blocked), so neither the REST API's
 * availability nor the HTML fallback's exact markup could be verified
 * live. Both paths fail loudly (a `type: "error"` event) rather than
 * silently returning zero results — see docs/ADDING_A_SOURCE.md.
 */

const BASE_URL = "https://www.diarioeconomico.co.mz";
const CATEGORY_SLUG = "concursos-publicos";
const REQUEST_TIMEOUT_MS = 20_000;
const USER_AGENT = "NemusTenderIntelligence/1.0 (+internal tool for Nemus Africa; contact: iris@nemus.africa)";

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: controller.signal });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" }, signal: controller.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function stripHtml(html: string): string {
  return cheerio.load(html).root().text().replace(/\s+/g, " ").trim();
}

interface WpCategory {
  id: number;
  slug: string;
}
interface WpPost {
  link: string;
  date: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
}

async function* viaRestApi(): AsyncGenerator<AdapterEvent, boolean> {
  const categories = await fetchJson<WpCategory[]>(`${BASE_URL}/wp-json/wp/v2/categories?slug=${CATEGORY_SLUG}`);
  if (!categories || categories.length === 0) {
    yield { type: "log", message: "WordPress REST API category lookup failed or is disabled — falling back to HTML scraping." };
    return false;
  }

  const posts = await fetchJson<WpPost[]>(`${BASE_URL}/wp-json/wp/v2/posts?categories=${categories[0].id}&per_page=30`);
  if (!posts) {
    yield { type: "log", message: "WordPress REST API posts lookup failed — falling back to HTML scraping." };
    return false;
  }

  yield { type: "log", message: `WordPress REST API: found ${posts.length} post(s) in "${CATEGORY_SLUG}".` };

  for (const post of posts) {
    const title = stripHtml(post.title.rendered);
    const contentText = stripHtml(post.content.rendered);
    const excerptText = stripHtml(post.excerpt.rendered) || contentText.slice(0, 400);

    const documents: RawDocument[] = [];
    const pdfMatch = post.content.rendered.match(/href="([^"]+\.pdf)"/i);
    if (pdfMatch) documents.push({ url: pdfMatch[1], fileTypeHint: "pdf" });

    yield {
      type: "announcement",
      announcement: {
        organizationRaw: guessOrganization(contentText) ?? "Not extracted from article text",
        title,
        description: excerptText,
        sourceUrl: post.link,
        announcementUrl: post.link,
        publicationDate: new Date(post.date),
        sourcePublicationDate: new Date(post.date),
        externalRef: extractReferenceNumber(contentText),
        deadline: extractDeadline(contentText),
        documents,
        sourceDescription: `Diário Económico — Concursos Públicos (${post.link})`,
        inferredFields: guessOrganization(contentText) ? undefined : ["organizationRaw"],
      },
    };
  }

  return true;
}

async function* viaHtmlFallback(): AsyncGenerator<AdapterEvent> {
  const categoryUrl = `${BASE_URL}/category/${CATEGORY_SLUG}/`;
  yield { type: "log", message: `Fetching ${categoryUrl}` };

  const html = await fetchHtml(categoryUrl);
  if (!html) {
    yield { type: "error", fatal: true, message: `Failed to reach Diário Económico at ${categoryUrl}.` };
    return;
  }

  const $ = cheerio.load(html);
  // Standard WordPress theme structure: article elements with an entry-title link.
  const articles = $("article, .post, .entry").toArray();
  if (articles.length === 0) {
    yield {
      type: "error",
      fatal: false,
      message: `No article elements found at ${categoryUrl} — the theme's markup may differ from the standard WordPress structure assumed here. Verify manually.`,
    };
    return;
  }

  yield { type: "log", message: `HTML fallback: found ${articles.length} article element(s).` };

  for (const el of articles) {
    const $el = $(el);
    const linkEl = $el.find("a[href]").first();
    const url = linkEl.attr("href");
    const title = ($el.find("h1, h2, h3, .entry-title").first().text() || linkEl.text()).trim();
    if (!url || !title) continue;

    const text = $el.text().replace(/\s+/g, " ").trim();
    yield {
      type: "announcement",
      announcement: {
        organizationRaw: guessOrganization(text) ?? "Not extracted from article text",
        title: title.slice(0, 200),
        description: text.slice(0, 1000),
        sourceUrl: url,
        announcementUrl: url,
        externalRef: extractReferenceNumber(text),
        deadline: extractDeadline(text),
        sourceDescription: `Diário Económico — Concursos Públicos (${url})`,
        inferredFields: guessOrganization(text) ? undefined : ["organizationRaw"],
      },
    };
  }
}

export const diarioEconomicoAdapter: SourceAdapter = {
  key: "diario-economico",
  name: "Diário Económico — Concursos Públicos",
  requiresAuth: false,
  validationStatus: "NEEDS_VALIDATION",
  async *run(_ctx: AdapterRunContext): AsyncGenerator<AdapterEvent> {
    const restApiWorked = yield* viaRestApi();
    if (!restApiWorked) {
      yield* viaHtmlFallback();
    }
  },
};
