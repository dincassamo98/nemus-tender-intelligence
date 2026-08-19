/**
 * Generic structured-field extraction helpers shared by adapters that parse
 * free text (OCR output, PDF text, raw HTML text) rather than a clean API —
 * i.e. Jornal Notícias and, as a fallback, UFSA. Deliberately conservative:
 * every function returns `undefined`/`null` rather than guessing when it
 * isn't confident, because a wrong extracted date is worse than a missing one
 * (missing fields surface in the UI as "requires review"; wrong ones don't).
 */

const PT_MONTHS: Record<string, number> = {
  janeiro: 0,
  fevereiro: 1,
  março: 2,
  marco: 2,
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
};

/**
 * Parses dates in the formats commonly used in Mozambican public
 * announcements: "14 de Setembro de 2026", "14/09/2026", "14-09-2026".
 * Returns all matches found in the text, in order of appearance.
 */
export function extractDates(text: string): Date[] {
  const results: Date[] = [];

  const longFormRe = /(\d{1,2})\s+de\s+([a-zA-Zçãéíóú]+)\s+de\s+(\d{4})/gi;
  for (const m of text.matchAll(longFormRe)) {
    const day = parseInt(m[1], 10);
    const monthName = m[2].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const month = PT_MONTHS[monthName];
    const year = parseInt(m[3], 10);
    if (month !== undefined && day >= 1 && day <= 31) {
      results.push(new Date(Date.UTC(year, month, day)));
    }
  }

  const numericRe = /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/g;
  for (const m of text.matchAll(numericRe)) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    const year = parseInt(m[3], 10);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      results.push(new Date(Date.UTC(year, month, day)));
    }
  }

  return results;
}

const DEADLINE_MARKERS = [
  "prazo de entrega",
  "prazo limite",
  "data limite",
  "até ao dia",
  "até às",
  "submissão até",
  "deadline",
  "closing date",
];

/**
 * Looks for a date that appears near a deadline-indicating phrase, which is
 * far more reliable than "take the last date in the text".
 */
export function extractDeadline(text: string): Date | undefined {
  const normalized = text.toLowerCase();
  for (const marker of DEADLINE_MARKERS) {
    const idx = normalized.indexOf(marker);
    if (idx === -1) continue;
    const window = text.slice(idx, idx + 120);
    const dates = extractDates(window);
    if (dates.length > 0) return dates[0];
  }
  return undefined;
}

const REFERENCE_MARKER_RE = /(?:n[ºo°]\.?\s?|ref(?:er[eê]ncia)?\.?\s?:?\s?)/i;
// Deliberately case-sensitive: a real reference code ("MICOA/DNAAS/012/2026")
// is uppercase/digit-heavy. Matching case-insensitively let this pick up
// ordinary lowercase words following "referência" in plain Portuguese prose
// — worth getting right since a wrong reference number breaks dedupe.
const REFERENCE_TOKEN_RE = /[A-Z0-9][A-Z0-9/.\-]{3,}/;

export function extractReferenceNumber(text: string): string | undefined {
  const markerMatch = text.match(REFERENCE_MARKER_RE);
  if (!markerMatch || markerMatch.index === undefined) return undefined;

  const after = text.slice(markerMatch.index + markerMatch[0].length);
  const tokenMatch = after.match(REFERENCE_TOKEN_RE);
  if (!tokenMatch) return undefined;
  if (!/[0-9/]/.test(tokenMatch[0])) return undefined; // avoid matching a plain capitalized word

  return tokenMatch[0].trim();
}

const ORG_MARKERS = [
  "ministério d",
  "ministério da",
  "ministério de",
  "governo d",
  "conselho municipal d",
  "município d",
  "direcção provincial d",
  "direção provincial d",
  "instituto",
  "empresa",
  "fundo",
];

/**
 * Best-effort organization guess from free text: looks for a line containing
 * a known institutional marker. Returns undefined rather than a wrong guess
 * when no marker is found — the UI then shows "not extracted" and the item
 * still surfaces (recall first), just flagged as missing information.
 */
export function guessOrganization(text: string): string | undefined {
  const lines = text.split(/\n|\.(?=\s|$)/).map((l) => l.trim());
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (ORG_MARKERS.some((marker) => lower.includes(marker))) {
      return line.length > 140 ? line.slice(0, 140) : line;
    }
  }
  return undefined;
}

export function firstSentenceAsTitle(text: string, maxLen = 140): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  const sentenceEnd = trimmed.search(/[.!?]\s/);
  const candidate = sentenceEnd > 10 ? trimmed.slice(0, sentenceEnd) : trimmed;
  return candidate.length > maxLen ? candidate.slice(0, maxLen).trim() + "…" : candidate;
}
