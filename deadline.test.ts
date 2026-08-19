import { describe, it, expect } from "vitest";
import { computeDeadlineInfo, DEFAULT_URGENCY_THRESHOLDS } from "@/lib/deadline";

const NOW = new Date("2026-08-19T12:00:00Z");

function daysFromNow(days: number, hours = 0): Date {
  return new Date(NOW.getTime() + days * 86400000 + hours * 3600000);
}

describe("computeDeadlineInfo", () => {
  it("returns UNKNOWN when there is no deadline", () => {
    expect(computeDeadlineInfo(null, NOW).urgency).toBe("UNKNOWN");
  });

  it("returns EXPIRED for a past deadline", () => {
    const info = computeDeadlineInfo(daysFromNow(-1), NOW);
    expect(info.urgency).toBe("EXPIRED");
    expect(info.isExpired).toBe(true);
  });

  it("returns CRITICAL under the urgent-hours threshold", () => {
    const info = computeDeadlineInfo(daysFromNow(0, 10), NOW);
    expect(info.urgency).toBe("CRITICAL");
  });

  it("returns URGENT between 48h and soonDays", () => {
    const info = computeDeadlineInfo(daysFromNow(5), NOW);
    expect(info.urgency).toBe("URGENT");
  });

  it("returns SOON between soonDays and approachingDays", () => {
    const info = computeDeadlineInfo(daysFromNow(10), NOW);
    expect(info.urgency).toBe("SOON");
  });

  it("returns APPROACHING between approachingDays and comfortableDays", () => {
    const info = computeDeadlineInfo(daysFromNow(20), NOW);
    expect(info.urgency).toBe("APPROACHING");
  });

  it("returns COMFORTABLE beyond comfortableDays", () => {
    const info = computeDeadlineInfo(daysFromNow(45), NOW);
    expect(info.urgency).toBe("COMFORTABLE");
  });

  it("respects custom thresholds", () => {
    // Default thresholds put a 10-day-out deadline in SOON (soonDays=7, approachingDays=15).
    // Shrinking approachingDays to 8 should push that same 10-day deadline out to APPROACHING.
    const info = computeDeadlineInfo(daysFromNow(10), NOW, { ...DEFAULT_URGENCY_THRESHOLDS, approachingDays: 8 });
    expect(info.urgency).toBe("APPROACHING");
  });
});
