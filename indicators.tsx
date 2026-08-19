import { Badge } from "./badge";
import { computeDeadlineInfo, URGENCY_LABELS, type UrgencyLevel } from "@/lib/deadline";
import type { ClassificationBucket } from "@/lib/intelligence/classifier";

const CLASSIFICATION_META: Record<ClassificationBucket, { emoji: string; label: string; tone: "critical" | "success" | "warning" | "neutral" | "danger" }> = {
  CRITICAL: { emoji: "🔥", label: "Critical opportunity", tone: "critical" },
  HIGH: { emoji: "🟢", label: "Highly relevant", tone: "success" },
  MEDIUM: { emoji: "🟡", label: "Potentially relevant", tone: "warning" },
  LOW: { emoji: "⚪", label: "Low relevance", tone: "neutral" },
  NOT_RELEVANT: { emoji: "🔴", label: "Not relevant", tone: "danger" },
};

export function ClassificationBadge({ classification, score }: { classification: ClassificationBucket; score?: number }) {
  const meta = CLASSIFICATION_META[classification];
  return (
    <Badge tone={meta.tone}>
      <span aria-hidden>{meta.emoji}</span>
      {meta.label}
      {typeof score === "number" ? <span className="opacity-70">· {score}/100</span> : null}
    </Badge>
  );
}

const URGENCY_TONE: Record<UrgencyLevel, "success" | "warning" | "danger" | "critical" | "neutral"> = {
  COMFORTABLE: "success",
  APPROACHING: "warning",
  SOON: "warning",
  URGENT: "danger",
  CRITICAL: "critical",
  EXPIRED: "neutral",
  UNKNOWN: "neutral",
};

export function DeadlineBadge({ deadline }: { deadline: Date | string | null }) {
  const d = deadline ? new Date(deadline) : null;
  const info = computeDeadlineInfo(d);
  const meta = URGENCY_LABELS[info.urgency];
  return (
    <Badge tone={URGENCY_TONE[info.urgency]} title={d ? d.toLocaleString() : undefined}>
      <span aria-hidden>{meta.emoji}</span>
      {d
        ? info.isExpired
          ? "Expired"
          : `${info.daysRemaining}d remaining`
        : "No deadline found"}
    </Badge>
  );
}

const STATUS_LABEL: Record<string, string> = {
  NEW: "New",
  REVIEWING: "Reviewing",
  PURSUING: "Pursuing",
  SUBMITTED: "Submitted",
  WON: "Won",
  LOST: "Lost",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = status === "WON" ? "success" : status === "LOST" || status === "REJECTED" ? "danger" : status === "PURSUING" || status === "SUBMITTED" ? "primary" : "neutral";
  return <Badge tone={tone}>{STATUS_LABEL[status] ?? status}</Badge>;
}

export function DemoBadge() {
  return (
    <Badge tone="accent" title="Synthetic sample data — not a real discovered opportunity">
      Demo data
    </Badge>
  );
}

export function ProvenanceBadge({ confidence }: { confidence: "CONFIRMED" | "INFERRED" | "AI_GENERATED" }) {
  const meta = {
    CONFIRMED: { label: "Confirmed", tone: "success" as const },
    INFERRED: { label: "Inferred", tone: "warning" as const },
    AI_GENERATED: { label: "AI-generated", tone: "accent" as const },
  }[confidence];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
