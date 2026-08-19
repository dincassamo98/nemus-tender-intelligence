import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "info" | "warning" | "danger" | "success";

const TONE_CLASSES: Record<Tone, string> = {
  info: "bg-muted text-foreground border-border",
  warning: "bg-warning-bg text-warning border-warning/30",
  danger: "bg-danger-bg text-danger border-danger/30",
  success: "bg-success-bg text-success border-success/30",
};

export function Alert({ tone = "info", className, ...props }: HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return <div className={cn("rounded-md border px-4 py-3 text-sm", TONE_CLASSES[tone], className)} {...props} />;
}
