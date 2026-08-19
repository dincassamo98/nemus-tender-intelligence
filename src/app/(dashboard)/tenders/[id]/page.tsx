import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TenderActions } from "@/components/tenders/tender-actions";
import { NotesPanel } from "@/components/tenders/notes-panel";
import { EmailDraftPanel } from "@/components/tenders/email-draft-panel";

function fmt(d: Date | null): string | null {
  return d ? new Date(d).toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" }) : null;
}

export default async function TenderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const tender = await prisma.tender.findUnique({
    where: { id },
    include: {
      source: true,
      documents: true,
      changes: { orderBy: { detectedAt: "desc" } },
      notes: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      sightings: { include: { source: { select: { name: true } } }, orderBy: { firstSeenAt: "asc" } },
    },
  });

  if (!tender) notFound();

  const keyDates = (
    [
      ["Publicação", tender.publicationDate],
      ["Prazo de submissão", tender.deadline],
      ["Esclarecimentos até", tender.clarificationDeadline],
      ["Abertura de propostas", tender.openingDate],
    ] as [string, Date | null][]
  ).filter(([, value]) => value !== null);

  const requirementGroups = (
    [
      ["Elegibilidade", tender.eligibilityRequirements],
      ["Qualificações exigidas", tender.requiredQualifications],
      ["Documentos exigidos", tender.requiredDocuments],
    ] as [string, string[]][]
  ).filter(([, items]) => items.length > 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <div>
        <Link href="/" className="text-xs font-medium text-muted-foreground hover:text-foreground">
          ← Voltar
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-foreground">{tender.title}</h1>
        <p className="text-sm text-muted-foreground">
          {tender.organizationRaw}
          {tender.geography ? ` · ${tender.geography}` : ""}
          {tender.externalRef ? ` · Ref. ${tender.externalRef}` : ""}
        </p>
        <p className="mt-1 text-sm font-medium text-foreground">
          {tender.deadline ? `Prazo: ${fmt(tender.deadline)}` : "Prazo não indicado"} · {tender.relevanceScore}% relevante
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <TenderActions tenderId={tender.id} status={tender.status} watchlisted={tender.watchlisted} />
        <EmailDraftPanel tenderId={tender.id} />
      </div>

      {tender.aiSummary || tender.classificationReasons.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Porque interessa à Nemus África</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">{tender.aiSummary ?? tender.classificationReasons.join(" ")}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Descrição</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground whitespace-pre-line">{tender.description}</p>
        </CardContent>
      </Card>

      {keyDates.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Datas importantes</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            {keyDates.map(([label, value]) => (
              <div key={label}>
                <p className="text-muted-foreground">{label}</p>
                <p className="font-medium text-foreground">{fmt(value)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {requirementGroups.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Requisitos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {requirementGroups.map(([label, items]) => (
              <div key={label}>
                <p className="mb-1 font-medium text-foreground">{label}</p>
                <ul className="list-inside list-disc space-y-0.5 text-foreground">
                  {items.map((it, i) => (
                    <li key={i}>{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {tender.documents.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Documentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {tender.documents.map((d) => (
              <a
                key={d.id}
                href={d.originalUrl}
                target="_blank"
                rel="noreferrer"
                className="block text-sm text-primary hover:underline"
              >
                {d.originalUrl.split("/").pop()}
              </a>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {tender.changes.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Alterações desde a publicação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tender.changes.map((c) => (
              <p key={c.id} className="text-sm text-warning">
                {c.description}
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Fonte</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground">
            <a href={tender.sourceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              {tender.source.name}
            </a>
            {tender.publicationDate ? ` · ${fmt(tender.publicationDate)}` : ""}
          </p>
          {tender.sightings.length > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Também encontrado em: {tender.sightings.map((s) => s.source.name).join(", ")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notas</CardTitle>
        </CardHeader>
        <CardContent>
          <NotesPanel tenderId={tender.id} notes={tender.notes} />
        </CardContent>
      </Card>
    </div>
  );
}
