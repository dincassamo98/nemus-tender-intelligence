import Link from "next/link";
import { cn } from "@/lib/utils";
import { computeDeadlineInfo } from "@/lib/deadline";
import { WatchlistToggle } from "./watchlist-toggle";

export interface TenderCardData {
  id: string;
  title: string;
  organizationRaw: string;
  relevanceScore: number;
  deadline: Date | string | null;
  classificationReasons: string[];
  geography?: string | null;
  watchlisted?: boolean;
}

function formatDeadline(deadline: Date | string | null): string {
  if (!deadline) return "Prazo não indicado";
  return `Prazo: ${new Date(deadline).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })}`;
}

/**
 * One card, one job: let Iris decide in two seconds whether to open it.
 * Plain text hierarchy (title → org/deadline/relevance → why → action) —
 * no stacked badges. Colour is reserved for genuine urgency only.
 */
export function TenderCard({ tender }: { tender: TenderCardData }) {
  const deadlineInfo = computeDeadlineInfo(tender.deadline ? new Date(tender.deadline) : null);
  const isUrgent = deadlineInfo.urgency === "URGENT" || deadlineInfo.urgency === "CRITICAL";

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <Link href={`/tenders/${tender.id}`} className="block">
        <h3 className="text-sm font-semibold text-foreground">{tender.title}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {tender.organizationRaw}
          {tender.geography ? ` · ${tender.geography}` : ""}
        </p>
        <p className={cn("mt-1.5 text-sm", isUrgent ? "font-medium text-danger" : "text-foreground")}>
          {formatDeadline(tender.deadline)} · {tender.relevanceScore}% relevante
        </p>
        {tender.classificationReasons[0] ? (
          <p className="mt-1.5 text-sm italic text-muted-foreground">{tender.classificationReasons[0]}</p>
        ) : null}
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <Link href={`/tenders/${tender.id}`} className="text-sm font-medium text-primary hover:underline">
          Ver concurso →
        </Link>
        <WatchlistToggle tenderId={tender.id} initialWatchlisted={tender.watchlisted} />
      </div>
    </div>
  );
}
