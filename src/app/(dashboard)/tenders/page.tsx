import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { TenderCard } from "@/components/tenders/tender-card";
import { FeedFilters } from "@/components/tenders/feed-filters";
import { EmptyState } from "@/components/ui/empty-state";
import { now, daysFromNow } from "@/lib/time";

const PAGE_SIZE = 20;

export default async function TenderFeedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const where: Prisma.TenderWhereInput = { source: { isDemo: false } };

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

  const includeDemo = await prisma.tender.count({ where: { source: { isDemo: false } } }).then((n) => n === 0);
  if (includeDemo) where.source = { isDemo: true };

  const orderBy: Prisma.TenderOrderByWithRelationInput =
    sp.sort === "deadline" ? { deadline: "asc" } : sp.sort === "recent" ? { discoveredAt: "desc" } : { relevanceScore: "desc" };

  const page = Math.max(1, Number(sp.page ?? "1"));
  const [tenders, total] = await Promise.all([
    prisma.tender.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { source: { select: { name: true, isDemo: true } } },
    }),
    prisma.tender.count({ where }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Oportunidades ({total})</h1>
      </div>
      <FeedFilters />

      {includeDemo ? (
        <p className="rounded-md bg-accent/10 px-3 py-2 text-xs text-accent-foreground">
          Nenhuma oportunidade real descoberta ainda — a mostrar dados de demonstração para ilustrar o produto.
        </p>
      ) : null}

      {tenders.length === 0 ? (
        <EmptyState title="Sem resultados para estes filtros." description="Experimente ajustar os filtros acima." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {tenders.map((t) => (
            <TenderCard key={t.id} tender={t} />
          ))}
        </div>
      )}
    </div>
  );
}
