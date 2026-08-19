"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const STATUS_OPTIONS = [
  { value: "NEW", label: "Novo" },
  { value: "REVIEWING", label: "Em revisão" },
  { value: "PURSUING", label: "A concorrer" },
  { value: "SUBMITTED", label: "Submetido" },
  { value: "WON", label: "Ganho" },
  { value: "LOST", label: "Perdido" },
  { value: "REJECTED", label: "Rejeitado" },
];

export function TenderActions({ tenderId, status, watchlisted }: { tenderId: string; status: string; watchlisted: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [localWatchlisted, setLocalWatchlisted] = useState(watchlisted);

  async function patch(body: Record<string, unknown>) {
    await fetch(`/api/tenders/${tenderId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        defaultValue={status}
        disabled={isPending}
        onChange={(e) => patch({ status: e.target.value })}
        className="h-9 rounded-md border border-border bg-card px-2 text-sm"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <button
        disabled={isPending}
        onClick={() => {
          setLocalWatchlisted(!localWatchlisted);
          patch({ watchlisted: !localWatchlisted });
        }}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        {localWatchlisted ? "★ Watchlist" : "☆ Watchlist"}
      </button>
    </div>
  );
}
