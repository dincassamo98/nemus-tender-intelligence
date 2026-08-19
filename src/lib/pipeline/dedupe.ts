import { diceCoefficient, normalizeForMatching } from "./similarity";

/**
 * Minimal shape of an already-persisted tender needed for dedup comparison.
 * Kept narrow and DB-agnostic so this module is unit-testable without Prisma.
 */
export interface ExistingTenderLite {
  id: string;
  externalRef: string | null;
  organizationRaw: string;
  title: string;
  sourceUrl: string;
  announcementUrl: string | null;
  deadline: Date | null;
  documentHashes: string[];
}

export interface CandidateTender {
  externalRef: string | null;
  organizationRaw: string;
  title: string;
  sourceUrl: string;
  announcementUrl: string | null;
  deadline: Date | null;
  documentHashes: string[];
}

export type DedupeMatchType = "EXACT_REFERENCE" | "EXACT_URL" | "DOCUMENT_HASH" | "FUZZY_MATCH" | null;

export interface DedupeResult {
  match: ExistingTenderLite | null;
  matchType: DedupeMatchType;
  similarity: number; // 0-1, informational
  /** true if a match was found but one or more tracked fields differ — an update, not a pure duplicate */
  hasDifferences: boolean;
}

const FUZZY_TITLE_THRESHOLD = 0.62;
const FUZZY_ORG_THRESHOLD = 0.7;

export function computeDedupeKey(organizationRaw: string, title: string): string {
  return `${normalizeForMatching(organizationRaw)}::${normalizeForMatching(title).slice(0, 80)}`;
}

function deadlinesDiffer(a: Date | null, b: Date | null): boolean {
  if (!a && !b) return false;
  if (!a || !b) return true;
  return a.getTime() !== b.getTime();
}

/**
 * Find the best duplicate/update candidate for a freshly-extracted tender
 * against a pool of already-known tenders (typically: same source over a
 * lookback window, or a cross-source pool when cross-source dedupe is
 * enabled). Never relies on URL equality alone (spec section 16).
 */
export function findDuplicateCandidate(
  candidate: CandidateTender,
  existingPool: ExistingTenderLite[]
): DedupeResult {
  // 1. Exact reference number match within the same organization.
  if (candidate.externalRef) {
    const refMatch = existingPool.find(
      (t) =>
        t.externalRef &&
        t.externalRef.trim().toLowerCase() === candidate.externalRef!.trim().toLowerCase() &&
        normalizeForMatching(t.organizationRaw) === normalizeForMatching(candidate.organizationRaw)
    );
    if (refMatch) {
      return {
        match: refMatch,
        matchType: "EXACT_REFERENCE",
        similarity: 1,
        hasDifferences: deadlinesDiffer(refMatch.deadline, candidate.deadline),
      };
    }
  }

  // 2. Exact URL match (announcement URL, falling back to source URL).
  const urlMatch = existingPool.find(
    (t) =>
      (candidate.announcementUrl && t.announcementUrl === candidate.announcementUrl) ||
      (t.sourceUrl === candidate.sourceUrl && t.title === candidate.title)
  );
  if (urlMatch) {
    return {
      match: urlMatch,
      matchType: "EXACT_URL",
      similarity: 1,
      hasDifferences: deadlinesDiffer(urlMatch.deadline, candidate.deadline),
    };
  }

  // 3. Shared document hash (same attached PDF, re-published elsewhere).
  if (candidate.documentHashes.length > 0) {
    const hashMatch = existingPool.find((t) =>
      t.documentHashes.some((h) => candidate.documentHashes.includes(h))
    );
    if (hashMatch) {
      return {
        match: hashMatch,
        matchType: "DOCUMENT_HASH",
        similarity: 1,
        hasDifferences: deadlinesDiffer(hashMatch.deadline, candidate.deadline),
      };
    }
  }

  // 4. Fuzzy match: similar org AND similar title.
  let best: { tender: ExistingTenderLite; score: number } | null = null;
  for (const existing of existingPool) {
    const orgSim = diceCoefficient(
      normalizeForMatching(existing.organizationRaw),
      normalizeForMatching(candidate.organizationRaw)
    );
    if (orgSim < FUZZY_ORG_THRESHOLD) continue;

    const titleSim = diceCoefficient(normalizeForMatching(existing.title), normalizeForMatching(candidate.title));
    if (titleSim < FUZZY_TITLE_THRESHOLD) continue;

    const combined = orgSim * 0.4 + titleSim * 0.6;
    if (!best || combined > best.score) best = { tender: existing, score: combined };
  }

  if (best) {
    return {
      match: best.tender,
      matchType: "FUZZY_MATCH",
      similarity: best.score,
      hasDifferences: deadlinesDiffer(best.tender.deadline, candidate.deadline),
    };
  }

  return { match: null, matchType: null, similarity: 0, hasDifferences: false };
}
