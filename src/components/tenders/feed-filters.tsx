"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

const CLASSIFICATIONS = [
  { value: "", label: "Todas as classificações" },
  { value: "CRITICAL", label: "🔥 Crítica" },
  { value: "HIGH", label: "🟢 Alta" },
  { value: "MEDIUM", label: "🟡 Média" },
  { value: "LOW", label: "⚪ Baixa" },
  { value: "NOT_RELEVANT", label: "🔴 Não relevante" },
];

const STATUSES = [
  { value: "", label: "Todos os estados" },
  { value: "NEW", label: "Novo" },
  { value: "REVIEWING", label: "Em revisão" },
  { value: "PURSUING", label: "A concorrer" },
  { value: "SUBMITTED", label: "Submetido" },
  { value: "WON", label: "Ganho" },
  { value: "LOST", label: "Perdido" },
  { value: "REJECTED", label: "Rejeitado" },
];

const SORTS = [
  { value: "relevance", label: "Relevância" },
  { value: "deadline", label: "Prazo" },
  { value: "recent", label: "Mais recente" },
];

export function FeedFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        placeholder="Pesquisar título, organização…"
        defaultValue={searchParams.get("q") ?? ""}
        onKeyDown={(e) => {
          if (e.key === "Enter") update("q", (e.target as HTMLInputElement).value);
        }}
        className="h-9 min-w-56 rounded-md border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <select
        value={searchParams.get("classification") ?? ""}
        onChange={(e) => update("classification", e.target.value)}
        className="h-9 rounded-md border border-border bg-card px-2 text-sm"
      >
        {CLASSIFICATIONS.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <select
        value={searchParams.get("status") ?? ""}
        onChange={(e) => update("status", e.target.value)}
        className="h-9 rounded-md border border-border bg-card px-2 text-sm"
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <select
        value={searchParams.get("sort") ?? "relevance"}
        onChange={(e) => update("sort", e.target.value)}
        className="h-9 rounded-md border border-border bg-card px-2 text-sm"
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            Ordenar: {s.label}
          </option>
        ))}
      </select>
      <label className="flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-2 text-sm">
        <input
          type="checkbox"
          checked={searchParams.get("deadlineWithinDays") === "30"}
          onChange={(e) => update("deadlineWithinDays", e.target.checked ? "30" : "")}
        />
        Prazo &lt; 30 dias
      </label>
    </div>
  );
}
