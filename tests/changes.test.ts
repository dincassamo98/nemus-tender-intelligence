import { describe, it, expect } from "vitest";
import { detectChanges, type TenderSnapshot } from "@/lib/pipeline/changes";

const base: TenderSnapshot = {
  deadline: new Date("2026-09-10"),
  clarificationDeadline: null,
  submissionDeadline: new Date("2026-09-10"),
  openingDate: null,
  estimatedValue: null,
  eligibilityRequirements: ["Registo comercial válido"],
  requiredQualifications: [],
  requiredDocuments: ["Proposta técnica"],
};

describe("detectChanges", () => {
  it("detects no changes when snapshots are identical", () => {
    expect(detectChanges(base, { ...base })).toHaveLength(0);
  });

  it("detects a deadline change with a human-readable description", () => {
    const next: TenderSnapshot = { ...base, deadline: new Date("2026-09-17") };
    const changes = detectChanges(base, next);
    expect(changes.some((c) => c.changeType === "DEADLINE_CHANGED" && c.fieldName === "deadline")).toBe(true);
    const deadlineChange = changes.find((c) => c.fieldName === "deadline")!;
    expect(deadlineChange.description).toContain("changed from");
    expect(deadlineChange.description).toMatch(/2026/);
  });

  it("detects a newly added requirement", () => {
    const next: TenderSnapshot = { ...base, requiredDocuments: ["Proposta técnica", "Certidão de registo comercial"] };
    const changes = detectChanges(base, next);
    expect(changes.some((c) => c.changeType === "REQUIREMENT_ADDED" && c.newValue === "Certidão de registo comercial")).toBe(true);
  });

  it("detects a removed requirement", () => {
    const next: TenderSnapshot = { ...base, eligibilityRequirements: [] };
    const changes = detectChanges(base, next);
    expect(changes.some((c) => c.changeType === "REQUIREMENT_REMOVED" && c.oldValue === "Registo comercial válido")).toBe(true);
  });

  it("does not flag a requirement as changed if only reordered", () => {
    const next: TenderSnapshot = {
      ...base,
      requiredDocuments: ["Proposta técnica"], // same single item
    };
    expect(detectChanges(base, next)).toHaveLength(0);
  });

  it("detects estimated value changes", () => {
    const next: TenderSnapshot = { ...base, estimatedValue: 500000 };
    const changes = detectChanges(base, next);
    expect(changes.some((c) => c.changeType === "VALUE_CHANGED")).toBe(true);
  });
});
