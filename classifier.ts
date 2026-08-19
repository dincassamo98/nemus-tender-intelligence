import { NEMUS_PROFILE } from "./nemus-profile";

export type ClassificationBucket = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NOT_RELEVANT";

/**
 * Configurable score thresholds. Kept as a single exported constant (rather
 * than magic numbers scattered through the codebase) so tuning the
 * classifier's aggressiveness is a one-line change — see docs/ARCHITECTURE.md
 * "Tuning the classifier".
 */
export const CLASSIFICATION_THRESHOLDS: Record<ClassificationBucket, number> = {
  CRITICAL: 80,
  HIGH: 60,
  MEDIUM: 35,
  LOW: 15,
  NOT_RELEVANT: 0,
};

export interface ClassifierInput {
  title: string;
  description: string;
  organizationRaw?: string;
  geography?: string | null;
  documentText?: string; // extracted text from attached documents, if any
}

export interface ClassificationResult {
  relevanceScore: number; // 0-100
  confidenceScore: number; // 0-100 — how much this score should be trusted given available text
  classification: ClassificationBucket;
  matchingCapabilities: string[];
  reasons: string[]; // human-readable "why this matters" bullets — never a black box
  missingInformation: string[];
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // strip accents so "avaliação" matches "avaliacao"
}

function countHits(haystack: string, keywords: string[]): string[] {
  return keywords.filter((kw) => haystack.includes(normalize(kw)));
}

function bucketFor(score: number): ClassificationBucket {
  if (score >= CLASSIFICATION_THRESHOLDS.CRITICAL) return "CRITICAL";
  if (score >= CLASSIFICATION_THRESHOLDS.HIGH) return "HIGH";
  if (score >= CLASSIFICATION_THRESHOLDS.MEDIUM) return "MEDIUM";
  if (score >= CLASSIFICATION_THRESHOLDS.LOW) return "LOW";
  return "NOT_RELEVANT";
}

export interface RelevanceClassifier {
  readonly providerName: string;
  classify(input: ClassifierInput): ClassificationResult;
}

/**
 * Rule-based v1 classifier, grounded in NEMUS_PROFILE. This intentionally
 * favors recall over precision (spec section 48: false negatives are more
 * dangerous than false positives during discovery) — generic procurement
 * language alone is capped at a low score rather than discarded, so a human
 * still sees the item, but a real environmental/sustainability domain match
 * is required to reach HIGH/CRITICAL.
 *
 * This implements RelevanceClassifier so a future semantic/embeddings or
 * LLM-backed classifier can be swapped in via getClassifier() below without
 * touching any pipeline or UI code.
 */
export const ruleBasedClassifier: RelevanceClassifier = {
  providerName: "rule-based-v1",
  classify(input: ClassifierInput): ClassificationResult {
    const fullText = normalize(
      [input.title, input.description, input.organizationRaw ?? "", input.documentText ?? ""].join("\n")
    );

    const areaContributions: { name: string; weight: number; hits: string[] }[] = [];
    let domainScore = 0;
    let genericProcurementOnly = true;

    for (const area of NEMUS_PROFILE.serviceAreas) {
      const hits = [...countHits(fullText, area.keywordsPt), ...countHits(fullText, area.keywordsEn)];
      if (hits.length === 0) continue;

      areaContributions.push({ name: area.name, weight: area.weight, hits });

      // Diminishing returns per area: first hit counts fully, extra hits add less.
      const areaStrength = Math.min(1, 0.6 + 0.15 * (hits.length - 1));
      domainScore += areaStrength * area.weight * 100;

      if (area.weight > 0.4) genericProcurementOnly = false; // a real domain area matched, not just procurement boilerplate
    }

    // Normalize: cap contribution so no single area alone can hit 100, but two
    // strong overlapping domains (e.g. EIA + climate) legitimately can.
    let score = Math.min(100, domainScore * 0.55);

    if (genericProcurementOnly && score > 0) {
      // Only generic "concurso"/"consultoria" language matched — real signal
      // is weak. Keep it visible (recall) but don't let it masquerade as HIGH.
      score = Math.min(score, 20);
    }

    // Geography bonus/context
    const geoText = normalize([input.geography ?? "", fullText].join(" "));
    const primaryGeoHit = NEMUS_PROFILE.geographicFocus.primary.some((g) => geoText.includes(normalize(g)));
    const secondaryGeoHit = NEMUS_PROFILE.geographicFocus.secondary.some((g) => geoText.includes(normalize(g)));
    if (primaryGeoHit) score += 8;
    else if (secondaryGeoHit) score += 4;

    // Preferred client type bonus
    const clientHit = NEMUS_PROFILE.preferredClientTypes.find((c) => fullText.includes(normalize(c)));
    if (clientHit) score += 5;

    // Past-project pattern bonus (strong prior signal)
    const pastProjectHit = NEMUS_PROFILE.pastProjectSignals.find((s) => fullText.includes(normalize(s)));
    if (pastProjectHit) score += 6;

    score = Math.max(0, Math.min(100, Math.round(score)));

    // Build human-readable reasons from the top 3 contributing areas.
    const topAreas = areaContributions
      .filter((a) => a.weight > 0.4)
      .sort((a, b) => b.weight * b.hits.length - a.weight * a.hits.length)
      .slice(0, 3);

    const reasons: string[] = topAreas.map(
      (a) => `${a.name} — mentions "${a.hits.slice(0, 3).join('", "')}"`
    );
    if (primaryGeoHit) reasons.push("Located in Mozambique — Nemus África's primary market");
    else if (secondaryGeoHit) reasons.push("Located in a country where Nemus operates (Southern/Eastern Africa)");
    if (clientHit) reasons.push(`Publishing organization matches a client type Nemus África typically serves ("${clientHit}")`);
    if (pastProjectHit) reasons.push("Matches a pattern from Nemus África's past project history");
    if (reasons.length === 0) {
      reasons.push("No strong environmental/sustainability/consulting signal detected in the extracted text");
    }

    const missingInformation: string[] = [];
    if (!input.description || input.description.trim().length < 40) {
      missingInformation.push("Description is very short or missing — score may be based on title alone");
    }
    if (!input.organizationRaw) {
      missingInformation.push("Contracting organization could not be extracted");
    }

    // Confidence reflects how much text this decision was based on, independent of relevanceScore.
    let confidenceScore = 50;
    if (input.description && input.description.length > 200) confidenceScore += 20;
    if (input.documentText && input.documentText.length > 500) confidenceScore += 20;
    if (missingInformation.length === 0) confidenceScore += 10;
    confidenceScore = Math.max(0, Math.min(100, confidenceScore));

    return {
      relevanceScore: score,
      confidenceScore,
      classification: bucketFor(score),
      matchingCapabilities: areaContributions.map((a) => a.name),
      reasons,
      missingInformation,
    };
  },
};

export function getClassifier(): RelevanceClassifier {
  // Extension point: read process.env.CLASSIFIER_PROVIDER to select a future
  // semantic/LLM-backed implementation. Only rule-based-v1 exists today —
  // this app never silently pretends to call an LLM without a configured key.
  return ruleBasedClassifier;
}
