"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface TriggerResult {
  status?: string;
  itemsNew?: number;
  errorsCount?: number;
}

/**
 * Refresh: "a procurar novos concursos…" then a one-line result. The
 * detailed per-source ingestion log is a debugging tool, not something
 * Iris needs every time she clicks this — that detail lives on the
 * Fontes page for whoever needs it.
 */
export function RefreshButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  async function handleRefresh() {
    setLoading(true);
    setSummary(null);
    try {
      const res = await fetch("/api/ingestion/trigger", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      const results: TriggerResult[] = data.results ?? [];
      const totalNew = results.reduce((sum, r) => sum + (r.itemsNew ?? 0), 0);
      const hadError = results.some((r) => (r.errorsCount ?? 0) > 0 || r.status === "FAILED");
      setSummary(
        results.length === 0
          ? "Nenhuma fonte activa para verificar."
          : hadError
            ? "Verificação concluída, mas uma fonte teve um problema — ver Fontes."
            : totalNew > 0
              ? `${totalNew} novo(s) concurso(s) encontrado(s).`
              : "Sem concursos novos."
      );
      router.refresh();
    } catch {
      setSummary("A verificação falhou. Tenta novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="sm" onClick={handleRefresh} disabled={loading}>
        <span aria-hidden>↻</span>
        {loading ? "A procurar novos concursos…" : "Atualizar"}
      </Button>
      {summary ? <span className="text-xs text-muted-foreground">{summary}</span> : null}
    </div>
  );
}
