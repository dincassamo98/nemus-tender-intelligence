import { differenceInCalendarDays } from "date-fns";
import type { ClassificationBucket } from "./classifier";

export interface SummaryInput {
  title: string;
  organizationRaw: string;
  geography: string | null;
  classification: ClassificationBucket;
  relevanceScore: number;
  confidenceScore: number;
  reasons: string[];
  deadline: Date | null;
  missingInformation: string[];
  requiredDocuments: string[];
  consortiumNotes: string | null;
}

export interface GeneratedSummary {
  aiSummary: string;
  recommendedAction: "PURSUE" | "REVIEW" | "LOW_PRIORITY";
  recommendedActionReason: string;
  risks: string[];
}

/**
 * Rule-based executive summary + recommendation (spec sections 14, 47).
 * Every sentence here is derived deterministically from fields already on
 * the tender — nothing is fabricated. This is intentionally the extension
 * point for swapping in an LLM-generated summary later (behind an
 * AI-generated disclosure, per spec section 12) without touching callers.
 */
export function generateSummary(input: SummaryInput, now: Date = new Date()): GeneratedSummary {
  const risks: string[] = [...input.missingInformation];

  const daysRemaining = input.deadline ? differenceInCalendarDays(input.deadline, now) : null;
  const isExpired = daysRemaining !== null && daysRemaining < 0;

  if (isExpired) {
    risks.push("Deadline has already passed based on extracted data — verify before acting");
  } else if (daysRemaining !== null && daysRemaining <= 3) {
    risks.push(`Deadline is very tight (${daysRemaining} day(s) remaining) — limited time to prepare a competitive bid`);
  }

  if (input.confidenceScore < 50) {
    risks.push("Extraction confidence is low — key fields may be incomplete; verify against the original source before deciding");
  }

  if (input.consortiumNotes) {
    risks.push("Consortium/joint-venture requirement noted — confirm partner availability early");
  }

  if (input.requiredDocuments.length === 0) {
    risks.push("Required documents list not extracted — check the original announcement/documents");
  }

  let recommendedAction: GeneratedSummary["recommendedAction"];
  let recommendedActionReason: string;

  if (isExpired || input.classification === "NOT_RELEVANT") {
    recommendedAction = "LOW_PRIORITY";
    recommendedActionReason = isExpired
      ? "Deadline appears to have passed."
      : "Low alignment with Nemus África's service areas.";
  } else if (
    (input.classification === "CRITICAL" || input.classification === "HIGH") &&
    (daysRemaining === null || daysRemaining >= 3)
  ) {
    recommendedAction = "PURSUE";
    recommendedActionReason = `Strong fit (${input.relevanceScore}/100) with enough time remaining to prepare a bid.`;
  } else if (input.classification === "MEDIUM" || (daysRemaining !== null && daysRemaining < 3)) {
    recommendedAction = "REVIEW";
    recommendedActionReason =
      input.classification === "MEDIUM"
        ? "Moderate fit — worth a human read before committing effort."
        : "Good fit but the deadline is very tight — assess feasibility first.";
  } else {
    recommendedAction = "LOW_PRIORITY";
    recommendedActionReason = "Weak alignment with Nemus África's service areas.";
  }

  const geographyPhrase = input.geography ? ` in ${input.geography}` : "";
  const deadlinePhrase = input.deadline
    ? isExpired
      ? "its deadline has already passed"
      : `the deadline is in ${daysRemaining} day(s)`
    : "no deadline was extracted from the source";

  const reasonPhrase = input.reasons.length > 0 ? input.reasons[0] : "no strong domain signal was detected";

  const aiSummary =
    `"${input.title}" was published by ${input.organizationRaw}${geographyPhrase}. ` +
    `${deadlinePhrase}. Relevance to Nemus África is scored ${input.relevanceScore}/100 (${input.classification}), ` +
    `primarily because: ${reasonPhrase}.`;

  return { aiSummary, recommendedAction, recommendedActionReason, risks };
}
