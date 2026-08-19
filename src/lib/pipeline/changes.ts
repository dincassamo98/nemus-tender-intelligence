import { format } from "date-fns";

/**
 * Fields tracked for change detection (spec section 17). Kept narrow and
 * DB-agnostic (no Prisma types) so it's unit-testable in isolation.
 */
export interface TenderSnapshot {
  deadline: Date | null;
  clarificationDeadline: Date | null;
  submissionDeadline: Date | null;
  openingDate: Date | null;
  estimatedValue: number | null;
  eligibilityRequirements: string[];
  requiredQualifications: string[];
  requiredDocuments: string[];
}

export interface DetectedChange {
  changeType:
    | "DEADLINE_CHANGED"
    | "REQUIREMENT_ADDED"
    | "REQUIREMENT_REMOVED"
    | "VALUE_CHANGED"
    | "OTHER";
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  description: string;
}

const DATE_FIELDS: { key: keyof TenderSnapshot; label: string }[] = [
  { key: "deadline", label: "Deadline" },
  { key: "clarificationDeadline", label: "Clarification deadline" },
  { key: "submissionDeadline", label: "Submission deadline" },
  { key: "openingDate", label: "Opening date" },
];

const LIST_FIELDS: { key: keyof TenderSnapshot; label: string; changeType: DetectedChange["changeType"] }[] = [
  { key: "eligibilityRequirements", label: "Eligibility requirement", changeType: "REQUIREMENT_ADDED" },
  { key: "requiredQualifications", label: "Required qualification", changeType: "REQUIREMENT_ADDED" },
  { key: "requiredDocuments", label: "Required document", changeType: "REQUIREMENT_ADDED" },
];

function fmtDate(d: Date | null): string | null {
  return d ? format(d, "d MMM yyyy") : null;
}

export function detectChanges(previous: TenderSnapshot, next: TenderSnapshot): DetectedChange[] {
  const changes: DetectedChange[] = [];

  for (const { key, label } of DATE_FIELDS) {
    const prevVal = previous[key] as Date | null;
    const nextVal = next[key] as Date | null;
    const prevTime = prevVal ? prevVal.getTime() : null;
    const nextTime = nextVal ? nextVal.getTime() : null;
    if (prevTime !== nextTime) {
      const oldStr = fmtDate(prevVal);
      const newStr = fmtDate(nextVal);
      changes.push({
        changeType: "DEADLINE_CHANGED",
        fieldName: key,
        oldValue: oldStr,
        newValue: newStr,
        description:
          oldStr && newStr
            ? `${label} changed from ${oldStr} to ${newStr}`
            : newStr
              ? `${label} added: ${newStr}`
              : `${label} removed`,
      });
    }
  }

  if (previous.estimatedValue !== next.estimatedValue) {
    changes.push({
      changeType: "VALUE_CHANGED",
      fieldName: "estimatedValue",
      oldValue: previous.estimatedValue?.toString() ?? null,
      newValue: next.estimatedValue?.toString() ?? null,
      description: `Estimated value changed from ${previous.estimatedValue ?? "unknown"} to ${next.estimatedValue ?? "unknown"}`,
    });
  }

  for (const { key, label } of LIST_FIELDS) {
    const prevList = (previous[key] as string[]) ?? [];
    const nextList = (next[key] as string[]) ?? [];
    const prevSet = new Set(prevList.map((s) => s.trim().toLowerCase()));
    const nextSet = new Set(nextList.map((s) => s.trim().toLowerCase()));

    for (const item of nextList) {
      if (!prevSet.has(item.trim().toLowerCase())) {
        changes.push({
          changeType: "REQUIREMENT_ADDED",
          fieldName: key,
          oldValue: null,
          newValue: item,
          description: `${label} added: "${item}"`,
        });
      }
    }
    for (const item of prevList) {
      if (!nextSet.has(item.trim().toLowerCase())) {
        changes.push({
          changeType: "REQUIREMENT_REMOVED",
          fieldName: key,
          oldValue: item,
          newValue: null,
          description: `${label} removed: "${item}"`,
        });
      }
    }
  }

  return changes;
}
