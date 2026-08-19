/**
 * Deadline intelligence (spec section 15). Thresholds are configurable and
 * exported, never hardcoded inline — and the UI always shows the actual
 * date/time alongside the color, never color alone.
 */
export type UrgencyLevel = "COMFORTABLE" | "APPROACHING" | "SOON" | "URGENT" | "CRITICAL" | "EXPIRED" | "UNKNOWN";

export interface UrgencyThresholds {
  comfortableDays: number; // >= this many days => COMFORTABLE
  approachingDays: number; // >= this many days => APPROACHING
  soonDays: number; // >= this many days => SOON
  urgentHours: number; // >= this many hours => URGENT, below => CRITICAL
}

export const DEFAULT_URGENCY_THRESHOLDS: UrgencyThresholds = {
  comfortableDays: 30,
  approachingDays: 15,
  soonDays: 7,
  urgentHours: 48,
};

export const URGENCY_LABELS: Record<UrgencyLevel, { emoji: string; label: string }> = {
  COMFORTABLE: { emoji: "🟢", label: "More than 30 days" },
  APPROACHING: { emoji: "🟡", label: "15–30 days" },
  SOON: { emoji: "🟠", label: "7–14 days" },
  URGENT: { emoji: "🔴", label: "Under 7 days" },
  CRITICAL: { emoji: "🚨", label: "Under 48 hours" },
  EXPIRED: { emoji: "⚫", label: "Expired" },
  UNKNOWN: { emoji: "❔", label: "No deadline found" },
};

export interface DeadlineInfo {
  urgency: UrgencyLevel;
  daysRemaining: number | null;
  hoursRemaining: number | null;
  isExpired: boolean;
}

export function computeDeadlineInfo(
  deadline: Date | null | undefined,
  now: Date = new Date(),
  thresholds: UrgencyThresholds = DEFAULT_URGENCY_THRESHOLDS
): DeadlineInfo {
  if (!deadline) {
    return { urgency: "UNKNOWN", daysRemaining: null, hoursRemaining: null, isExpired: false };
  }

  const msRemaining = deadline.getTime() - now.getTime();
  const hoursRemaining = msRemaining / (1000 * 60 * 60);
  const daysRemaining = msRemaining / (1000 * 60 * 60 * 24);

  if (msRemaining <= 0) {
    return { urgency: "EXPIRED", daysRemaining: 0, hoursRemaining: 0, isExpired: true };
  }

  let urgency: UrgencyLevel;
  if (hoursRemaining < thresholds.urgentHours) urgency = "CRITICAL";
  else if (daysRemaining < thresholds.soonDays) urgency = "URGENT";
  else if (daysRemaining < thresholds.approachingDays) urgency = "SOON";
  else if (daysRemaining < thresholds.comfortableDays) urgency = "APPROACHING";
  else urgency = "COMFORTABLE";

  return {
    urgency,
    daysRemaining: Math.ceil(daysRemaining),
    hoursRemaining: Math.round(hoursRemaining),
    isExpired: false,
  };
}
