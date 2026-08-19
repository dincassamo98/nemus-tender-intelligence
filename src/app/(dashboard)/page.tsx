import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { TenderCard } from "@/components/tenders/tender-card";
import { FeedFilters } from "@/components/tenders/feed-filters";
import { EmptyState } from "@/components/ui/empty-state";
import { auth } from "@/lib/auth";
import { now, daysFromNow } from "@/lib/time";

// Always fetch live data — this is a live operational feed, never a static shell.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

/**
 * Home = the feed. Not a dashboard. Iris should see opportunities, sorted
 * by what matters, within two seconds — no analytics to read first.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0] ?? "";

  const where: Prisma.TenderWhereInput = {
    status: { notIn: ["REJECTED", "LOST", "WON", "EXPIRED"] },
  };
  if (sp.status) where.status = sp.status as never;
  if (sp.classification) where.classification = sp.classification as never;
  if (sp.watchlisted === "true") where.watchlisted = true;
  if (sp.deadlineWithinDays) {
    where.deadline = { gte: now(), lte: daysFromNow(Number(sp.deadlineWithinDays)) };
  }
  if (sp.q) {
    where.OR = [
      { title: { contains: sp.q, mode: "insensitive" } },
      { description: { contains: sp.q, mode: "insensitive" } },
      { organizationRaw: { contains: sp.q, mode: "insensitive" } },
    ];
  }

  const orderBy: Prisma.TenderOrderByWithRelationInput =
    sp.sort === "deadline" ? { deadline: "asc" } : sp.sort === "recent" ? { discoveredAt: "desc" } : { relevanceScore: "desc" };

  const page = Math.max(1, Number(sp.page ?? "1"));
  const [tenders, total, newCount, lastRun] = await Promise.all([
    prisma.tender.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        organizationRaw: true,
        relevanceScore: true,
        classification: true,
        deadline: true,
        status: true,
        classificationReasons: true,
        geography: true,
        watchlisted: true,
        source: { select: { name: true, isDemo: true } },
      },
    }),
    prisma.tender.count({ where }),
    prisma.tender.count({ where: { ...where, status: "NEW" } }),
    prisma.sourceRun.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          {firstName ? `Bom dia, ${firstName}.` : "Bom dia."} {newCount > 0 ? `${newCount} novo(s) concurso(s)` : ""}
        </h1>
      </div>

      <FeedFilters />

      {tenders.length === 0 ? (
        <EmptyState
          icon="✓"
          title="Não há concursos novos."
          description={
            <p>
              Última verificação: {lastRun ? new Date(lastRun.startedAt).toLocaleString("pt-PT") : "ainda nenhuma"}. Use o botão{" "}
              <span className="font-medium">Refresh</span> no topo da página para verificar de novo.
            </p>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {tenders.map((t) => (
            <TenderCard key={t.id} tender={t} />
          ))}
        </div>
      )}

      {total > PAGE_SIZE ? (
        <p className="pt-2 text-center text-xs text-muted-foreground">
          A mostrar {tenders.length} de {total}
        </p>
      ) : null}
    </div>
  );
}
