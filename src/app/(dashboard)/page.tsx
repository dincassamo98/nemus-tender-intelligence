import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TenderCard } from "@/components/tenders/tender-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { now, daysFromNow } from "@/lib/time";

// Always fetch live data — this is a live operational dashboard, never a
// static shell (see docs/ARCHITECTURE.md "Rendering model").
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [topOpportunities, approachingDeadlines, pipelineCounts, sources, totalNew, lastRun] = await Promise.all([
    prisma.tender.findMany({
      where: { status: { in: ["NEW", "REVIEWING"] }, relevanceScore: { gte: 60 } },
      orderBy: { relevanceScore: "desc" },
      take: 5,
      include: { source: { select: { name: true, isDemo: true } } },
    }),
    prisma.tender.findMany({
      where: { deadline: { gte: now(), lte: daysFromNow(14) }, status: { notIn: ["REJECTED", "LOST", "EXPIRED"] } },
      orderBy: { deadline: "asc" },
      take: 5,
      include: { source: { select: { name: true, isDemo: true } } },
    }),
    prisma.tender.groupBy({ by: ["status"], _count: true }),
    prisma.source.findMany({ orderBy: { name: "asc" } }),
    prisma.tender.count({ where: { status: "NEW" } }),
    prisma.sourceRun.findFirst({ orderBy: { startedAt: "desc" }, include: { source: true } }),
  ]);

  const pipeline = Object.fromEntries(pipelineCounts.map((p) => [p.status, p._count]));
  const totalTenders = pipelineCounts.reduce((sum, p) => sum + p._count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Bem-vinda, o que precisa da sua atenção hoje?</h1>
        <p className="text-sm text-muted-foreground">
          {totalTenders === 0
            ? "Nenhuma oportunidade descoberta ainda — clique em Refresh para verificar as fontes."
            : `${totalNew} nova(s) oportunidade(s) desde a última revisão.`}
        </p>
      </div>

      {totalTenders === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon="🔎"
              title="Ainda sem oportunidades de alta prioridade"
              description={
                <div className="space-y-1">
                  <p>O sistema está pronto — nenhuma fonte foi verificada ainda nesta instância.</p>
                  <p>
                    Última execução: {lastRun ? `${lastRun.source.name} — ${lastRun.status}` : "nenhuma"}. Use o botão{" "}
                    <span className="font-medium">Refresh</span> no topo da página para verificar as fontes activas agora.
                  </p>
                </div>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>🧠 Recomendações — o que ver primeiro</CardTitle>
                <Link href="/tenders?sort=relevance" className="text-xs font-medium text-primary hover:underline">
                  Ver tudo
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {topOpportunities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem oportunidades de alta relevância neste momento.</p>
                ) : (
                  topOpportunities.map((t) => <TenderCard key={t.id} tender={t} />)
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>⏰ Prazos a aproximar-se (14 dias)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {approachingDeadlines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum prazo urgente.</p>
                ) : (
                  approachingDeadlines.map((t) => (
                    <Link key={t.id} href={`/tenders/${t.id}`} className="block rounded-md border border-border p-3 hover:bg-muted">
                      <p className="text-sm font-medium text-foreground line-clamp-1">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.deadline ? new Date(t.deadline).toLocaleDateString("pt-PT") : "—"}
                      </p>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>📊 Pipeline</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {["NEW", "REVIEWING", "PURSUING", "SUBMITTED", "WON", "LOST", "REJECTED"].map((status) => (
                  <Badge key={status} tone="neutral">
                    {status}: {pipeline[status] ?? 0}
                  </Badge>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>📡 Estado das fontes</CardTitle>
                <Link href="/sources" className="text-xs font-medium text-primary hover:underline">
                  Detalhes
                </Link>
              </CardHeader>
              <CardContent className="space-y-2">
                {sources.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{s.name}</span>
                    <Badge tone={s.enabled ? (s.lastErrorAt && (!s.lastSuccessfulRunAt || s.lastErrorAt > s.lastSuccessfulRunAt) ? "danger" : "success") : "neutral"}>
                      {s.enabled ? (s.lastSuccessfulRunAt ? "OK" : "Não executado") : "Desactivada"}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
