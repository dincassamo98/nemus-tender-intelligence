"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/** A single icon toggle — not a labelled action bar. One job: save for later. */
export function WatchlistToggle({ tenderId, initialWatchlisted = false }: { tenderId: string; initialWatchlisted?: boolean }) {
  const router = useRouter();
  const [watchlisted, setWatchlisted] = useState(initialWatchlisted);
  const [, startTransition] = useTransition();

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !watchlisted;
    setWatchlisted(next);
    await fetch(`/api/tenders/${tenderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ watchlisted: next }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <button
      onClick={toggle}
      title={watchlisted ? "Remover da watchlist" : "Adicionar à watchlist"}
      className="text-sm text-muted-foreground hover:text-foreground"
    >
      {watchlisted ? "★ Watchlist" : "☆ Watchlist"}
    </button>
  );
}
