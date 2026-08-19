import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null) {
  return d ? new Date(d).toLocaleString("pt-PT") : "Nunca verificada";
}

/**
 * Trust, not telemetry: is each source being checked, and when. Nothing
 * here should require a decision from Iris — it's a quick "yes, the
 * assistant is still looking" confirmation, not a monitoring console.
 */
export default async function SourcesPage() {
  const sources = await prisma.source.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Fontes</h1>
        <p className="text-sm text-muted-foreground">Onde procuramos novos concursos.</p>
      </div>

      <div className="divide-y divide-border rounded-lg border border-border bg-card">
        {sources
          .filter((s) => !s.isDemo)
          .map((s) => {
            const hasError = s.lastErrorAt && (!s.lastSuccessfulRunAt || s.lastErrorAt > s.lastSuccessfulRunAt);
            const tone = !s.enabled ? "neutral" : hasError ? "danger" : s.lastSuccessfulRunAt ? "success" : "neutral";
            const label = !s.enabled ? "Inactiva" : hasError ? "Com problema" : s.lastSuccessfulRunAt ? "A funcionar" : "Ainda não verificada";
            return (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(s.lastSuccessfulRunAt)}</p>
                </div>
                <Badge tone={tone}>{label}</Badge>
              </div>
            );
          })}
      </div>
    </div>
  );
}
