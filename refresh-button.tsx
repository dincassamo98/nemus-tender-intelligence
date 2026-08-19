"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface TriggerResult {
  sourceKey: string;
  mode: "inline" | "dispatched";
  status?: string;
  message?: string;
  dispatched?: boolean;
  itemsDiscovered?: number;
  itemsNew?: number;
  itemsUpdated?: number;
  itemsDuplicate?: number;
  errorsCount?: number;
}

/**
 * The Refresh button (spec section 27): triggers ingestion and shows exactly
 * what happened — sources checked, new/updated/duplicate/irrelevant counts,
 * and errors — never leaving the user wondering if it's actually working.
 */
export function RefreshButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TriggerResult[] | null>(null);
  const [open, setOpen] = useState(false);

  async function handleRefresh() {
    setLoading(true);
    setOpen(true);
    try {
      const res = await fetch("/api/ingestion/trigger", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      setResults(data.results ?? []);
      router.refresh();
    } catch {
      setResults([{ sourceKey: "unknown", mode: "inline", status: "FAILED", message: "Request failed." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <Button variant="secondary" size="sm" onClick={handleRefresh} disabled={loading}>
        <span aria-hidden>🔄</span>
        {loading ? "Checking sources…" : "Refresh"}
      </Button>

      {open && results ? (
        <div className="absolute right-0 z-20 mt-2 w-96 rounded-lg border border-border bg-card p-4 text-sm shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold text-foreground">Refresh results</p>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Close">
              ✕
            </button>
          </div>
          <ul className="space-y-2">
            {results.map((r, i) => (
              <li key={i} className="rounded-md bg-muted p-2">
                <p className="font-medium text-foreground">{r.sourceKey}</p>
                {r.mode === "dispatched" ? (
                  <p className="text-muted-foreground">{r.message}</p>
                ) : (
                  <p className="text-muted-foreground">
                    {r.status} — {r.itemsDiscovered ?? 0} scanned, {r.itemsNew ?? 0} new, {r.itemsUpdated ?? 0} updated,{" "}
                    {r.itemsDuplicate ?? 0} duplicate/ignored{r.errorsCount ? `, ${r.errorsCount} error(s)` : ""}
                  </p>
                )}
              </li>
            ))}
            {results.length === 0 ? <li className="text-muted-foreground">No enabled sources to run.</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
