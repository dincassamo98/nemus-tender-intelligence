import { chromium, type Browser, type Page } from "playwright";
import { createWorker } from "tesseract.js";
import type { AdapterEvent, AdapterRunContext, SourceAdapter, RawAnnouncement, RawEdition } from "./types";
import { extractDates, extractDeadline, extractReferenceNumber, guessOrganization, firstSentenceAsTitle } from "../pipeline/extract";
import { looksLikeAnnouncement } from "../intelligence/discovery-keywords";

/**
 * Jornal Notícias (flipbook-snoticias.app.co.mz) — authenticated digital
 * edition reader, subscription-gated.
 *
 * VALIDATION STATUS — read before trusting this in production:
 * This sandbox's network egress is blocked for flipbook-snoticias.app.co.mz
 * (confirmed via both WebFetch and direct curl during development), so the
 * login form, edition list, and page-rendering markup below could NOT be
 * inspected live. Public research (App Store/Play Store listing for
 * "Notícias Digital", built on a generic "Logica Software" flipbook engine
 * shared across several Mozambican newspaper titles, and the platform's own
 * terms stating "the newspaper becomes available the following day, with no
 * past editions made available") informed the design, but every selector
 * below is a best-effort default, deliberately overridable via
 * Source.config so a maintainer can fix drift without a code deploy:
 *
 *   {
 *     "loginEmailSelector": "input[type=email], input[name=email]",
 *     "loginPasswordSelector": "input[type=password], input[name=password]",
 *     "loginSubmitSelector": "button[type=submit], input[type=submit]",
 *     "editionLinkPattern": "\\d{4}-\\d{2}-\\d{2}",
 *     "nextPageSelector": "[aria-label*=next i], .next, button.page-next"
 *   }
 *
 * Because the source itself keeps no back-catalogue ("no past editions made
 * available"), this adapter's job is to capture *today's* (and, on first
 * run, a short backfill of) edition and persist it permanently — we become
 * the archive, not the newspaper's website. Run this only via the scheduled
 * GitHub Actions worker or locally with `pnpm ingest --source jornal-noticias`
 * (see .github/workflows/ingest.yml) — it needs a real browser and is too
 * slow/long-running for a Vercel serverless function.
 */

const LOGIN_URL = "https://flipbook-snoticias.app.co.mz/login.php";
const DEFAULT_SELECTORS = {
  loginEmailSelector: 'input[type="email"], input[name*="email" i], input[name*="user" i]',
  loginPasswordSelector: 'input[type="password"], input[name*="pass" i]',
  loginSubmitSelector: 'button[type="submit"], input[type="submit"], button:has-text("Entrar"), button:has-text("Login")',
  nextPageSelector:
    '[aria-label*="next" i], [aria-label*="seguinte" i], .next, button.page-next, a.next-page',
};
const MAX_PAGES_PER_EDITION = 48; // hard safety cap so a broken "next" loop can't run forever
const MAX_EDITIONS_PER_RUN = 7; // default lookback cap, overridable via ctx.lookbackDays
const NAV_TIMEOUT_MS = 30_000;
const MIN_TEXT_LAYER_LENGTH = 80; // below this, assume the page is an image and OCR is needed

interface AdapterSelectors {
  loginEmailSelector: string;
  loginPasswordSelector: string;
  loginSubmitSelector: string;
  editionLinkPattern?: string;
  nextPageSelector: string;
}

function resolveSelectors(config: Record<string, unknown>): AdapterSelectors {
  return { ...DEFAULT_SELECTORS, ...(config as Partial<AdapterSelectors>) };
}

async function login(page: Page, email: string, password: string, selectors: AdapterSelectors): Promise<void> {
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
  await page.locator(selectors.loginEmailSelector).first().fill(email, { timeout: 10_000 });
  await page.locator(selectors.loginPasswordSelector).first().fill(password, { timeout: 10_000 });
  await Promise.all([
    page.waitForLoadState("networkidle", { timeout: NAV_TIMEOUT_MS }).catch(() => undefined),
    page.locator(selectors.loginSubmitSelector).first().click({ timeout: 10_000 }),
  ]);

  const stillOnLogin = await page.locator(selectors.loginPasswordSelector).first().isVisible().catch(() => false);
  if (stillOnLogin) {
    throw new Error(
      "Still on the login form after submit — credentials may be wrong, or the site's login form structure changed. Check NOTICIAS_EMAIL/NOTICIAS_PASSWORD and Source.config selectors."
    );
  }
}

/** Generic date-like link scanner: looks at every link's href/text for a resolvable date. */
async function discoverEditions(page: Page, lookbackDays: number): Promise<RawEdition[]> {
  const links = await page.$$eval("a[href]", (as) =>
    as.map((a) => ({ href: (a as HTMLAnchorElement).href, text: a.textContent?.trim() ?? "" }))
  );

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

  const editions = new Map<string, RawEdition>();
  for (const link of links) {
    const dates = extractDates(`${link.text} ${link.href}`);
    if (dates.length === 0) continue;
    const publicationDate = dates[0];
    if (publicationDate < cutoffDate) continue;

    const externalId = publicationDate.toISOString().slice(0, 10);
    if (!editions.has(externalId)) {
      editions.set(externalId, { externalId, publicationDate, url: link.href });
    }
  }

  return [...editions.values()].sort((a, b) => b.publicationDate.getTime() - a.publicationDate.getTime());
}

async function extractPageText(page: Page, pageNumber: number, ocrWorker: Awaited<ReturnType<typeof createWorker>>): Promise<string> {
  const textLayer = await page.evaluate(() => document.body.innerText || "").catch(() => "");
  if (textLayer.trim().length >= MIN_TEXT_LAYER_LENGTH) {
    return textLayer;
  }

  // No usable text layer — this page is very likely rendered as an image or
  // canvas (typical for flipbook readers). Screenshot and OCR it.
  const screenshot = await page.screenshot({ fullPage: true }).catch(() => null);
  if (!screenshot) return textLayer;

  try {
    const { data } = await ocrWorker.recognize(screenshot);
    return data.text ?? "";
  } catch {
    return textLayer;
  }
}

function segmentIntoAnnouncements(pageText: string, sourceDescription: string, sourceUrl: string): RawAnnouncement[] {
  const blocks = pageText
    .split(/\n{2,}|(?=•\s)|(?=CONCURSO)|(?=ANÚNCIO)/i)
    .map((b) => b.trim())
    .filter((b) => b.length > 40);

  const announcements: RawAnnouncement[] = [];
  for (const block of blocks) {
    if (!looksLikeAnnouncement(block)) continue;

    const organization = guessOrganization(block);
    const reference = extractReferenceNumber(block);
    const deadline = extractDeadline(block);

    announcements.push({
      externalRef: reference,
      organizationRaw: organization ?? "Not extracted from page text",
      title: firstSentenceAsTitle(block),
      description: block,
      sourceUrl,
      deadline,
      submissionDeadline: deadline,
      sourceDescription,
      inferredFields: organization ? undefined : ["organizationRaw"],
    });
  }
  return announcements;
}

export const jornalNoticiasAdapter: SourceAdapter = {
  key: "jornal-noticias",
  name: "Jornal Notícias (Sociedade do Notícias)",
  requiresAuth: true,
  validationStatus: "NEEDS_VALIDATION",
  async *run(ctx: AdapterRunContext): AsyncGenerator<AdapterEvent> {
    const email = ctx.credentials.NOTICIAS_EMAIL;
    const password = ctx.credentials.NOTICIAS_PASSWORD;
    if (!email || !password) {
      yield {
        type: "error",
        fatal: true,
        message: "NOTICIAS_EMAIL / NOTICIAS_PASSWORD are not configured — skipping Jornal Notícias.",
      };
      return;
    }

    const selectors = resolveSelectors(ctx.config);
    const lookbackDays = Math.max(1, ctx.lookbackDays || 3);

    let browser: Browser | null = null;
    let ocrWorker: Awaited<ReturnType<typeof createWorker>> | null = null;

    try {
      yield { type: "log", message: "Launching browser and logging in to Jornal Notícias…" };
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({ userAgent: "Mozilla/5.0 (NemusTenderIntelligence internal ingestion)" });

      await login(page, email, password, selectors);
      yield { type: "log", message: "Login successful." };

      const editions = (await discoverEditions(page, lookbackDays)).slice(0, MAX_EDITIONS_PER_RUN);
      yield { type: "log", message: `Discovered ${editions.length} edition(s) within the last ${lookbackDays} day(s).` };

      if (editions.length === 0) {
        yield {
          type: "error",
          fatal: false,
          message:
            "No edition links matched the date-pattern scanner after login — the edition list page structure may differ from what this adapter expects. Check Source.config.editionLinkPattern.",
        };
      }

      ocrWorker = await createWorker("por");

      for (const edition of editions) {
        yield { type: "edition_discovered", edition };
        yield { type: "log", message: `Opening edition ${edition.externalId}…` };

        try {
          await page.goto(edition.url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
        } catch (err) {
          yield { type: "error", message: `Failed to open edition ${edition.externalId}: ${String(err)}` };
          continue;
        }

        let pageNumber = 1;
        let previousPageText = "";
        while (pageNumber <= MAX_PAGES_PER_EDITION) {
          const sourceDescription = `Jornal Notícias — Edição ${edition.publicationDate.toISOString().slice(0, 10)} — Página ${pageNumber}`;
          const text = await extractPageText(page, pageNumber, ocrWorker);

          if (pageNumber > 1 && text.trim() === previousPageText.trim()) {
            // Pagination stopped advancing — treat as end of edition.
            break;
          }
          previousPageText = text;

          const announcements = segmentIntoAnnouncements(text, sourceDescription, edition.url);
          for (const announcement of announcements) {
            yield { type: "announcement", announcement: { ...announcement, editionExternalId: edition.externalId } };
          }

          const nextButton = page.locator(selectors.nextPageSelector).first();
          const hasNext = await nextButton.isVisible().catch(() => false);
          if (!hasNext) break;

          await nextButton.click().catch(() => undefined);
          await page.waitForTimeout(800); // be a polite subscriber, not a hammer — spec section 35
          pageNumber++;
        }

        yield { type: "log", message: `Finished edition ${edition.externalId}: scanned ${pageNumber} page(s).` };
      }
    } catch (err) {
      yield {
        type: "error",
        fatal: true,
        message: `Jornal Notícias adapter failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    } finally {
      if (ocrWorker) await ocrWorker.terminate().catch(() => undefined);
      if (browser) await browser.close().catch(() => undefined);
    }
  },
};
