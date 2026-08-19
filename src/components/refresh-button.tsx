"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface TriggerResult {
  status?: string;
  itemsNew?: number;
  errorsCount?: number;
  message?: string;
}

/**
 * Each source gets its own request (and its own 60s Vercel function
 * budget), instead of one request looping every source — a single slow
 * source (e.g. OCR on a scanned PDF) used to be able to blow the shared
 * timeout and take every other source down with it, surfacing as a
 * useless "verification failed" with no real reason.
 */
async function triggerSource(sourceKey: string): Promise<TriggerResult> {
  try {
    const res = await fetch("/api/ingestion/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceKey }),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) return { status: "FAILED", errorsCount: 1, message: data.error ?? `HTTP ${res.status}` };
    return data.results?.[0] ?? { status: "FAILED", errorsCount: 1, message: "Resposta vazia." };
  } catch (err) {
    return { status: "FAILED", errorsCount: 1, message: err instanceof Error ? err.message : "Falha de rede." };
  }
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
      const sourcesRes = await fetch("/api/sources");
      if (!sourcesRes.ok) throw new Error(`Não foi possível listar as fontes (HTTP ${sourcesRes.status}).`);
      const sourcesData = await sourcesRes.json();
      const keys: string[] = (sourcesData.sources ?? [])
        .filter((s: { enabled: boolean; isDemo: boolean }) => s.enabled && !s.isDemo)
        .map((s: { key: string }) => s.key);

      if (keys.length === 0) {
        setSummary("Nenhuma fonte activa para verificar.");
        return;
      }

      const results = await Promise.all(keys.map(triggerSource));
      const totalNew = results.reduce((sum, r) => sum + (r.itemsNew ?? 0), 0);
      const failed = results.filter((r) => r.status === "FAILED");

      setSummary(
        failed.length > 0
          ? totalNew > 0
            ? `${totalNew} novo(s) concurso(s) encontrado(s). ${failed.length} fonte(s) falharam: ${failed.map((f) => f.message).join("; ")}`
            : `Verificação falhou em ${failed.length} fonte(s): ${failed.map((f) => f.message).join("; ")}`
          : totalNew > 0
            ? `${totalNew} novo(s) concurso(s) encontrado(s).`
            : "Sem concursos novos."
      );
      router.refresh();
    } catch (err) {
      setSummary(`A verificação falhou: ${err instanceof Error ? err.message : "erro desconhecido"}.`);
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
