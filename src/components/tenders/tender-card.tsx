import Link from "next/link";
import { ClassificationBadge, DeadlineBadge, DemoBadge, StatusBadge } from "@/components/ui/indicators";

export interface TenderCardData {
  id: string;
  title: string;
  organizationRaw: string;
  relevanceScore: number;
  classification: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NOT_RELEVANT";
  deadline: Date | string | null;
  status: string;
  classificationReasons: string[];
  source: { name: string; isDemo: boolean };
  geography?: string | null;
}

export function TenderCard({ tender }: { tender: TenderCardData }) {
  return (
    <Link
      href={`/tenders/${tender.id}`}
      className="block rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-md"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <ClassificationBadge classification={tender.classification} score={tender.relevanceScore} />
        <DeadlineBadge deadline={tender.deadline} />
        <StatusBadge status={tender.status} />
        {tender.source.isDemo ? <DemoBadge /> : null}
      </div>
      <h3 className="text-sm font-semibold text-foreground line-clamp-2">{tender.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {tender.organizationRaw}
        {tender.geography ? ` · ${tender.geography}` : ""}
      </p>
      {tender.classificationReasons[0] ? (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Why it matches: </span>
          {tender.classificationReasons[0]}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">Source: {tender.source.name}</p>
    </Link>
  );
}
