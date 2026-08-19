import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RESEARCHED_UNIMPLEMENTED_SOURCES } from "@/lib/adapters/registry";

export const dynamic = "force-dynamic";
import { getAdapter } from "@/lib/adapters/registry";

function formatDate(d: Date | null) {
  return d ? new Date(d).toLocaleString("pt-PT") : "Nunca";
}

export default async function SourcesPage() {
  const sources = await prisma.source.findMany({
    orderBy: { name: "asc" },
    include: { runs: { orderBy: { startedAt: "desc" }, take: 5 }, _count: { select: { tenders: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Fontes de dados</h1>
        <p className="text-sm text-muted-foreground">
          Estado de cada fonte de concursos: última execução, fiabilidade, e erros — nunca falha em silêncio.
        </p>
      </div>

      <div className="space-y-4">
        {sources.map((s) => {
          const adapter = getAdapter(s.adapterKey);
          const healthTone = !s.enabled ? "neutral" : s.lastErrorAt && (!s.lastSuccessfulRunAt || s.lastErrorAt > s.lastSuccessfulRunAt) ? "danger" : s.lastSuccessfulRunAt ? "success" : "neutral";
          return (
            <Card key={s.id}>
              <CardHeader>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {s.name}
                    {s.isDemo ? <Badge tone="accent">Demo</Badge> : null}
                    {!s.enabled ? <Badge tone="neutral">Desactivada</Badge> : null}
                    {adapter?.validationStatus === "NEEDS_VALIDATION" ? (
                      <Badge tone="warning" title="Ainda não validado contra o site real — ver notas abaixo">
                        Requer validação
                      </Badge>
                    ) : null}
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">{s.baseUrl}</p>
                </div>
                <Badge tone={healthTone}>
                  {!s.enabled ? "Desactivada" : healthTone === "danger" ? "Com erro" : s.lastSuccessfulRunAt ? "OK" : "Nunca executada"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground">Fiabilidade</p>
                    <p className="font-medium text-foreground">{s.reliabilityScore}/100</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Última execução com sucesso</p>
                    <p className="font-medium text-foreground">{formatDate(s.lastSuccessfulRunAt)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Última tentativa</p>
                    <p className="font-medium text-foreground">{formatDate(s.lastAttemptedRunAt)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Oportunidades encontradas</p>
                    <p className="font-medium text-foreground">{s._count.tenders}</p>
                  </div>
                </div>

                {s.lastErrorMessage ? (
                  <div className="rounded-md bg-danger-bg px-3 py-2 text-xs text-danger">{s.lastErrorMessage}</div>
                ) : null}

                {s.notes ? <p className="text-xs text-muted-foreground">{s.notes}</p> : null}

                {s.runs.length > 0 ? (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Execuções recentes</p>
                    <div className="space-y-1">
                      {s.runs.map((r) => (
                        <div key={r.id} className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{formatDate(r.startedAt)}</span>
                          <span>
                            {r.status} · {r.itemsNew} novo(s) · {r.itemsUpdated} actualizado(s) · {r.itemsDuplicate} duplicado(s) ·{" "}
                            {r.errorsCount} erro(s)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fontes candidatas investigadas (não implementadas)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-2 text-sm text-muted-foreground">
            Avaliadas por relevância, fiabilidade e viabilidade de automação antes de decidir não as construir ainda — ver{" "}
            <code className="rounded bg-muted px-1">src/lib/adapters/registry.ts</code> para o racional completo de cada uma.
          </p>
          <div className="flex flex-wrap gap-2">
            {RESEARCHED_UNIMPLEMENTED_SOURCES.map((s) => (
              <Badge key={s} tone="neutral">
                {s}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
