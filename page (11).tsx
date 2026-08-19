import { prisma } from "@/lib/db";
import { TenderCard } from "@/components/tenders/tender-card";

export const dynamic = "force-dynamic";
import { EmptyState } from "@/components/ui/empty-state";

export default async function WatchlistPage() {
  const tenders = await prisma.tender.findMany({
    where: { watchlisted: true },
    orderBy: { deadline: "asc" },
    include: { source: { select: { name: true, isDemo: true } } },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Watchlist</h1>
        <p className="text-sm text-muted-foreground">
          Oportunidades marcadas para acompanhamento. Alterações de prazo ou requisitos aparecerão aqui.
        </p>
      </div>

      {tenders.length === 0 ? (
        <EmptyState
          icon="👀"
          title="A sua watchlist está vazia"
          description="Adicione oportunidades à watchlist a partir da página de detalhe para as acompanhar aqui."
        />
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
