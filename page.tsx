import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClassificationBadge, DeadlineBadge, DemoBadge, ProvenanceBadge, StatusBadge } from "@/components/ui/indicators";
import { TenderActions } from "@/components/tenders/tender-actions";
import { NotesPanel } from "@/components/tenders/notes-panel";
import { EmailDraftPanel } from "@/components/tenders/email-draft-panel";
import { Alert } from "@/components/ui/alert";

function fmt(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" }) : "Não indicado";
}

export default async function TenderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const tender = await prisma.tender.findUnique({
    where: { id },
    include: {
      source: true,
      edition: true,
      organization: true,
      documents: true,
      versions: { orderBy: { versionNumber: "desc" } },
      changes: { orderBy: { detectedAt: "desc" } },
      notes: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      activities: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 30 },
      provenance: true,
    },
  });

  if (!tender) notFound();

  const related = await prisma.tender.findMany({
    where: {
      id: { not: id },
      OR: [
        ...(tender.organizationId ? [{ organizationId: tender.organizationId }] : []),
        ...(tender.categoryTags.length ? [{ categoryTags: { hasSome: tender.categoryTags } }] : []),
      ],
    },
    take: 5,
    orderBy: { relevanceScore: "desc" },
    select: { id: true, title: true, relevanceScore: true, deadline: true },
  });

  return (
    <div className="space-y-6 pb-12">
      <div>
        <Link href="/tenders" className="text-xs font-medium text-muted-foreground hover:text-foreground">
          ← Voltar à lista
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <ClassificationBadge classification={tender.classification} score={tender.relevanceScore} />
              <DeadlineBadge deadline={tender.deadline} />
              <StatusBadge status={tender.status} />
              {tender.source.isDemo ? <DemoBadge /> : null}
            </div>
            <h1 className="text-xl font-semibold text-foreground">{tender.title}</h1>
            <p className="text-sm text-muted-foreground">
              {tender.organizationRaw}
              {tender.geography ? ` · ${tender.geography}` : ""}
              {tender.externalRef ? ` · Ref. ${tender.externalRef}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <EmailDraftPanel tenderId={tender.id} />
          </div>
        </div>
        <div className="mt-3">
          <TenderActions tenderId={tender.id} status={tender.status} watchlisted={tender.watchlisted} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Visão geral da oportunidade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-foreground whitespace-pre-line">{tender.description}</p>
              {tender.categoryTags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {tender.categoryTags.map((c) => (
                    <Badge key={c} tone="neutral">
                      {c}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🧠 Porque interessa à Nemus África</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Alert tone="info">
                Gerado automaticamente a partir dos campos abaixo — ver o separador de proveniência para a origem de cada facto.
              </Alert>
              {tender.aiSummary ? <p className="text-sm text-foreground">{tender.aiSummary}</p> : null}
              <ul className="list-inside list-disc space-y-1 text-sm text-foreground">
                {tender.classificationReasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
              {tender.recommendedAction ? (
                <p className="rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                  Recomendação: {tender.recommendedAction}
                </p>
              ) : null}
              {tender.risks.length > 0 ? (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Riscos / pontos de atenção</p>
                  <ul className="list-inside list-disc space-y-1 text-sm text-warning">
                    {tender.risks.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Datas-chave</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              {(
                [
                  ["Publicação", tender.publicationDate],
                  ["Prazo de submissão", tender.deadline],
                  ["Esclarecimentos até", tender.clarificationDeadline],
                  ["Abertura de propostas", tender.openingDate],
                ] as [string, Date | null][]
              ).map(([label, value]) => (
                <div key={label}>
                  <p className="text-muted-foreground">{label}</p>
                  <p className="font-medium text-foreground">{fmt(value)}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Requisitos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                ["Elegibilidade", tender.eligibilityRequirements],
                ["Qualificações exigidas", tender.requiredQualifications],
                ["Documentos exigidos", tender.requiredDocuments],
              ].map(([label, items]) => (
                <div key={label as string}>
                  <p className="mb-1 font-medium text-foreground">{label as string}</p>
                  {(items as string[]).length === 0 ? (
                    <p className="text-muted-foreground">Não extraído do anúncio original.</p>
                  ) : (
                    <ul className="list-inside list-disc space-y-0.5 text-foreground">
                      {(items as string[]).map((it, i) => (
                        <li key={i}>{it}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documentos</CardTitle>
            </CardHeader>
            <CardContent>
              {tender.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum documento anexo identificado.</p>
              ) : (
                <div className="space-y-2">
                  {tender.documents.map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                      <a href={d.originalUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {d.originalUrl.split("/").pop()}
                      </a>
                      <div className="flex items-center gap-2">
                        <Badge tone="neutral">{d.fileType ?? "?"}</Badge>
                        <Badge tone={d.parsingStatus === "DONE" ? "success" : "danger"}>{d.parsingStatus}</Badge>
                        {d.ocrApplied ? <Badge tone="accent">OCR</Badge> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {tender.changes.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>⚠️ Alterações detectadas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {tender.changes.map((c) => (
                  <div key={c.id} className="rounded-md bg-warning-bg p-2 text-sm text-warning">
                    {c.description}
                    <span className="ml-2 text-xs opacity-70">{new Date(c.detectedAt).toLocaleString("pt-PT")}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Origem / proveniência</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-foreground">
                Fonte: <a href={tender.sourceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{tender.source.name}</a>
              </p>
              <div className="space-y-1.5">
                {tender.provenance.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-md bg-muted px-2 py-1.5 text-xs">
                    <div>
                      <span className="font-medium text-foreground">{p.fieldName}</span>
                      <span className="ml-2 text-muted-foreground">{p.sourceDescription}</span>
                    </div>
                    <ProvenanceBadge confidence={p.confidence} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notas</CardTitle>
            </CardHeader>
            <CardContent>
              <NotesPanel tenderId={tender.id} notes={tender.notes} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Histórico de actividade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {tender.activities.map((a) => (
                <div key={a.id} className="text-xs">
                  <p className="text-foreground">{a.description}</p>
                  <p className="text-muted-foreground">
                    {a.user?.name ?? "Sistema"} · {new Date(a.createdAt).toLocaleString("pt-PT")}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {related.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Oportunidades semelhantes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {related.map((r) => (
                  <Link key={r.id} href={`/tenders/${r.id}`} className="block rounded-md border border-border p-2 text-sm hover:bg-muted">
                    <p className="text-foreground line-clamp-1">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.relevanceScore}/100 · {fmt(r.deadline)}
                    </p>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
