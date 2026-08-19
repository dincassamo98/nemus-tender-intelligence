import { createHash } from "node:crypto";
import { prisma } from "../db";
import { getAdapter } from "../adapters/registry";
import type { AdapterRunContext, RawAnnouncement } from "../adapters/types";
import { computeDedupeKey, findDuplicateCandidate, type ExistingTenderLite } from "./dedupe";
import { detectChanges, type TenderSnapshot } from "./changes";
import { downloadAndProcessDocument } from "./documents";
import { getClassifier } from "../intelligence/classifier";
import { generateSummary } from "../intelligence/summary";
import { normalizeForMatching } from "./similarity";

const DEDUPE_POOL_DAYS = 180;
const DEDUPE_POOL_LIMIT = 2000;

type LogEntry = { at: string; level: "info" | "error"; message: string };

function nowIso(): string {
  return new Date().toISOString();
}

function contentHashOf(a: RawAnnouncement): string {
  const material = JSON.stringify({
    title: a.title,
    description: a.description,
    deadline: a.deadline?.toISOString() ?? null,
    requiredDocuments: a.requiredDocuments ?? [],
    eligibilityRequirements: a.eligibilityRequirements ?? [],
  });
  return createHash("sha256").update(material).digest("hex");
}

async function resolveOrganizationId(organizationRaw: string): Promise<string> {
  const normalizedName = normalizeForMatching(organizationRaw).slice(0, 250) || "unknown-organization";
  const org = await prisma.organization.upsert({
    where: { normalizedName },
    update: {},
    create: { name: organizationRaw, normalizedName },
  });
  return org.id;
}

async function loadDedupePool(): Promise<ExistingTenderLite[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DEDUPE_POOL_DAYS);

  const rows = await prisma.tender.findMany({
    where: { createdAt: { gte: cutoff } },
    take: DEDUPE_POOL_LIMIT,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      sourceId: true,
      externalRef: true,
      organizationRaw: true,
      title: true,
      sourceUrl: true,
      announcementUrl: true,
      deadline: true,
      documents: { select: { documentHash: true } },
    },
  });

  return rows.map((t) => ({
    id: t.id,
    sourceId: t.sourceId,
    externalRef: t.externalRef,
    organizationRaw: t.organizationRaw,
    title: t.title,
    sourceUrl: t.sourceUrl,
    announcementUrl: t.announcementUrl,
    deadline: t.deadline,
    documentHashes: t.documents.map((d) => d.documentHash).filter((h): h is string => !!h),
  }));
}

/**
 * Records that `sourceId` also carries this same real-world opportunity,
 * when it's not the tender's original/primary source (spec section 12:
 * cross-source intelligence — "1 opportunity, discovered across N
 * sources" rather than N separate tenders). Idempotent via the unique
 * (tenderId, sourceId) constraint.
 */
async function recordSourceSighting(
  tenderId: string,
  primarySourceId: string,
  sightingSourceId: string,
  sourceUrl: string,
  announcementUrl: string | null
) {
  if (sightingSourceId === primarySourceId) return;

  const existing = await prisma.tenderSourceSighting.findUnique({
    where: { tenderId_sourceId: { tenderId, sourceId: sightingSourceId } },
  });
  if (existing) return;

  const [sightingSource] = await Promise.all([
    prisma.source.findUniqueOrThrow({ where: { id: sightingSourceId }, select: { name: true } }),
    prisma.tenderSourceSighting.create({
      data: { tenderId, sourceId: sightingSourceId, sourceUrl, announcementUrl },
    }),
  ]);

  await prisma.activity.create({
    data: {
      tenderId,
      type: "SYSTEM",
      description: `Also discovered via ${sightingSource.name} — same opportunity, corroborated across sources.`,
    },
  });
}

async function persistDocuments(tenderId: string, announcement: RawAnnouncement) {
  const results = [];
  let i = 0;
  for (const doc of announcement.documents ?? []) {
    const processed = await downloadAndProcessDocument(doc.url, tenderId, i++);
    results.push(
      prisma.tenderDocument.create({
        data: {
          tenderId,
          originalUrl: doc.url,
          storagePath: processed.storagePath || null,
          fileType: processed.fileType,
          fileSizeBytes: processed.fileSizeBytes || null,
          documentHash: processed.documentHash || null,
          downloadedAt: processed.parsingStatus === "DONE" ? new Date() : null,
          extractedText: processed.extractedText,
          ocrApplied: processed.ocrApplied,
          ocrStatus: processed.ocrStatus,
          parsingStatus: processed.parsingStatus,
          errorMessage: processed.errorMessage ?? null,
        },
      })
    );
  }
  const created = await Promise.all(results);
  return created;
}

async function processNewAnnouncement(
  sourceId: string,
  editionId: string | null,
  announcement: RawAnnouncement
): Promise<{ classification: string }> {
  const organizationId = await resolveOrganizationId(announcement.organizationRaw);

  const tender = await prisma.tender.create({
    data: {
      sourceId,
      editionId,
      externalRef: announcement.externalRef ?? null,
      sourceUrl: announcement.sourceUrl,
      announcementUrl: announcement.announcementUrl ?? null,
      organizationId,
      organizationRaw: announcement.organizationRaw,
      title: announcement.title,
      description: announcement.description,
      categoryTags: announcement.categoryTags ?? [],
      geography: announcement.geography ?? null,
      estimatedValue: announcement.estimatedValue ?? null,
      currency: announcement.currency ?? null,
      contractDuration: announcement.contractDuration ?? null,
      procurementMethod: announcement.procurementMethod ?? null,
      tenderType: announcement.tenderType ?? null,
      publicationDate: announcement.publicationDate ?? null,
      sourcePublicationDate: announcement.sourcePublicationDate ?? null,
      deadline: announcement.deadline ?? null,
      clarificationDeadline: announcement.clarificationDeadline ?? null,
      submissionDeadline: announcement.submissionDeadline ?? null,
      openingDate: announcement.openingDate ?? null,
      eligibilityRequirements: announcement.eligibilityRequirements ?? [],
      requiredQualifications: announcement.requiredQualifications ?? [],
      requiredExperience: announcement.requiredExperience ?? [],
      requiredDocuments: announcement.requiredDocuments ?? [],
      financialRequirements: announcement.financialRequirements ?? null,
      technicalRequirements: announcement.technicalRequirements ?? null,
      dedupeKey: computeDedupeKey(announcement.organizationRaw, announcement.title),
      contentHash: contentHashOf(announcement),
      relevanceScore: 0,
      confidenceScore: 0,
      classification: "LOW",
    },
  });

  const documents = await persistDocuments(tender.id, announcement);
  const documentText = documents.map((d) => d.extractedText ?? "").join("\n\n");

  const classification = getClassifier().classify({
    title: announcement.title,
    description: announcement.description,
    organizationRaw: announcement.organizationRaw,
    geography: announcement.geography,
    documentText,
  });

  const summary = generateSummary({
    title: announcement.title,
    organizationRaw: announcement.organizationRaw,
    geography: announcement.geography ?? null,
    classification: classification.classification,
    relevanceScore: classification.relevanceScore,
    confidenceScore: classification.confidenceScore,
    reasons: classification.reasons,
    deadline: announcement.deadline ?? null,
    missingInformation: classification.missingInformation,
    requiredDocuments: announcement.requiredDocuments ?? [],
    consortiumNotes: null,
  });

  await prisma.tender.update({
    where: { id: tender.id },
    data: {
      relevanceScore: classification.relevanceScore,
      confidenceScore: classification.confidenceScore,
      classification: classification.classification,
      matchingCapabilities: classification.matchingCapabilities,
      classificationReasons: classification.reasons,
      missingInformation: classification.missingInformation,
      aiSummary: summary.aiSummary,
      recommendedAction: `${summary.recommendedAction} — ${summary.recommendedActionReason}`,
      risks: summary.risks,
    },
  });

  const provenanceRows: { fieldName: string; value: string; confidence: "CONFIRMED" | "INFERRED" | "AI_GENERATED" }[] = [
    { fieldName: "title", value: announcement.title, confidence: "CONFIRMED" },
    { fieldName: "organizationRaw", value: announcement.organizationRaw, confidence: announcement.inferredFields?.includes("organizationRaw") ? "INFERRED" : "CONFIRMED" },
  ];
  if (announcement.deadline) {
    provenanceRows.push({
      fieldName: "deadline",
      value: announcement.deadline.toISOString(),
      confidence: announcement.inferredFields?.includes("deadline") ? "INFERRED" : "CONFIRMED",
    });
  }
  provenanceRows.push({ fieldName: "relevanceScore", value: String(classification.relevanceScore), confidence: "AI_GENERATED" });
  provenanceRows.push({ fieldName: "aiSummary", value: summary.aiSummary, confidence: "AI_GENERATED" });

  await prisma.tenderFieldProvenance.createMany({
    data: provenanceRows.map((r) => ({
      tenderId: tender.id,
      fieldName: r.fieldName,
      value: r.value.slice(0, 2000),
      confidence: r.confidence,
      sourceDescription: announcement.sourceDescription,
    })),
  });

  await prisma.tenderVersion.create({
    data: { tenderId: tender.id, versionNumber: 1, snapshot: JSON.parse(JSON.stringify(announcement)) },
  });

  await prisma.activity.create({
    data: {
      tenderId: tender.id,
      type: "SYSTEM",
      description: `Discovered via ${announcement.sourceDescription}`,
    },
  });

  return { classification: classification.classification };
}

async function processUpdatedAnnouncement(existingId: string, announcement: RawAnnouncement) {
  const existing = await prisma.tender.findUniqueOrThrow({ where: { id: existingId } });

  const previousSnapshot: TenderSnapshot = {
    deadline: existing.deadline,
    clarificationDeadline: existing.clarificationDeadline,
    submissionDeadline: existing.submissionDeadline,
    openingDate: existing.openingDate,
    estimatedValue: existing.estimatedValue ? Number(existing.estimatedValue) : null,
    eligibilityRequirements: existing.eligibilityRequirements,
    requiredQualifications: existing.requiredQualifications,
    requiredDocuments: existing.requiredDocuments,
  };
  const nextSnapshot: TenderSnapshot = {
    deadline: announcement.deadline ?? existing.deadline,
    clarificationDeadline: announcement.clarificationDeadline ?? existing.clarificationDeadline,
    submissionDeadline: announcement.submissionDeadline ?? existing.submissionDeadline,
    openingDate: announcement.openingDate ?? existing.openingDate,
    estimatedValue: announcement.estimatedValue ?? (existing.estimatedValue ? Number(existing.estimatedValue) : null),
    eligibilityRequirements: announcement.eligibilityRequirements ?? existing.eligibilityRequirements,
    requiredQualifications: announcement.requiredQualifications ?? existing.requiredQualifications,
    requiredDocuments: announcement.requiredDocuments ?? existing.requiredDocuments,
  };

  const changes = detectChanges(previousSnapshot, nextSnapshot);
  if (changes.length === 0) return; // nothing material changed — avoid noisy no-op versions

  await prisma.tender.update({
    where: { id: existingId },
    data: {
      deadline: nextSnapshot.deadline,
      clarificationDeadline: nextSnapshot.clarificationDeadline,
      submissionDeadline: nextSnapshot.submissionDeadline,
      openingDate: nextSnapshot.openingDate,
      estimatedValue: nextSnapshot.estimatedValue,
      eligibilityRequirements: nextSnapshot.eligibilityRequirements,
      requiredQualifications: nextSnapshot.requiredQualifications,
      requiredDocuments: nextSnapshot.requiredDocuments,
      contentHash: contentHashOf(announcement),
    },
  });

  const latestVersion = await prisma.tenderVersion.findFirst({ where: { tenderId: existingId }, orderBy: { versionNumber: "desc" } });
  await prisma.tenderVersion.create({
    data: {
      tenderId: existingId,
      versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
      snapshot: JSON.parse(JSON.stringify(announcement)),
    },
  });

  await prisma.tenderChange.createMany({
    data: changes.map((c) => ({
      tenderId: existingId,
      changeType: c.changeType,
      fieldName: c.fieldName,
      oldValue: c.oldValue,
      newValue: c.newValue,
      description: c.description,
    })),
  });

  await prisma.activity.create({
    data: {
      tenderId: existingId,
      type: "CHANGE_DETECTED",
      description: `${changes.length} change(s) detected: ${changes.map((c) => c.description).join("; ")}`,
    },
  });
}

export interface IngestionSummary {
  sourceRunId: string;
  status: string;
  itemsDiscovered: number;
  itemsNew: number;
  itemsUpdated: number;
  itemsDuplicate: number;
  itemsIrrelevant: number;
  editionsScanned: number;
  errorsCount: number;
}

export async function runSourceIngestion(
  sourceKey: string,
  trigger: "MANUAL" | "SCHEDULED" = "MANUAL",
  triggeredById?: string
): Promise<IngestionSummary> {
  const source = await prisma.source.findUniqueOrThrow({ where: { key: sourceKey } });
  const adapter = getAdapter(source.adapterKey);

  const sourceRun = await prisma.sourceRun.create({
    data: { sourceId: source.id, status: "RUNNING", trigger, triggeredById },
  });

  const log: LogEntry[] = [{ at: nowIso(), level: "info", message: `Starting run for source "${source.name}".` }];
  const counters = { editionsScanned: 0, itemsDiscovered: 0, itemsNew: 0, itemsUpdated: 0, itemsDuplicate: 0, itemsIrrelevant: 0, errorsCount: 0 };
  let fatalMessage: string | null = null;

  if (!adapter) {
    fatalMessage = `No adapter registered for adapterKey "${source.adapterKey}".`;
    log.push({ at: nowIso(), level: "error", message: fatalMessage });
  } else {
    const ctx: AdapterRunContext = {
      config: (source.config as Record<string, unknown>) ?? {},
      credentials: {
        NOTICIAS_EMAIL: process.env.NOTICIAS_EMAIL,
        NOTICIAS_PASSWORD: process.env.NOTICIAS_PASSWORD,
      },
      lookbackDays: Number((source.config as Record<string, unknown>)?.lookbackDays ?? 3),
    };

    const dedupePool = await loadDedupePool();
    const editionIdByExternalId = new Map<string, string>();

    try {
      for await (const event of adapter.run(ctx)) {
        if (event.type === "log") {
          log.push({ at: nowIso(), level: "info", message: event.message });
        } else if (event.type === "error") {
          counters.errorsCount++;
          log.push({ at: nowIso(), level: "error", message: event.message });
          if (event.fatal) {
            fatalMessage = event.message;
            break;
          }
        } else if (event.type === "edition_discovered") {
          counters.editionsScanned++;
          const edition = await prisma.edition.upsert({
            where: { sourceId_externalId: { sourceId: source.id, externalId: event.edition.externalId } },
            update: { status: "PROCESSING" },
            create: {
              sourceId: source.id,
              externalId: event.edition.externalId,
              publicationDate: event.edition.publicationDate,
              url: event.edition.url,
              pageCount: event.edition.pageCount,
              status: "PROCESSING",
            },
          });
          editionIdByExternalId.set(event.edition.externalId, edition.id);
        } else if (event.type === "announcement") {
          counters.itemsDiscovered++;
          const a = event.announcement;
          const editionId = a.editionExternalId ? (editionIdByExternalId.get(a.editionExternalId) ?? null) : null;

          const dedupe = findDuplicateCandidate(
            {
              externalRef: a.externalRef ?? null,
              organizationRaw: a.organizationRaw,
              title: a.title,
              sourceUrl: a.sourceUrl,
              announcementUrl: a.announcementUrl ?? null,
              deadline: a.deadline ?? null,
              documentHashes: [],
            },
            dedupePool
          );

          try {
            if (!dedupe.match) {
              await processNewAnnouncement(source.id, editionId, a);
              counters.itemsNew++;
              dedupePool.push({
                id: "pending",
                sourceId: source.id,
                externalRef: a.externalRef ?? null,
                organizationRaw: a.organizationRaw,
                title: a.title,
                sourceUrl: a.sourceUrl,
                announcementUrl: a.announcementUrl ?? null,
                deadline: a.deadline ?? null,
                documentHashes: [],
              });
            } else if (dedupe.hasDifferences) {
              await processUpdatedAnnouncement(dedupe.match.id, a);
              await recordSourceSighting(dedupe.match.id, dedupe.match.sourceId, source.id, a.sourceUrl, a.announcementUrl ?? null);
              counters.itemsUpdated++;
            } else {
              await recordSourceSighting(dedupe.match.id, dedupe.match.sourceId, source.id, a.sourceUrl, a.announcementUrl ?? null);
              counters.itemsDuplicate++;
            }
          } catch (err) {
            counters.errorsCount++;
            log.push({
              at: nowIso(),
              level: "error",
              message: `Failed to persist announcement "${a.title.slice(0, 80)}": ${err instanceof Error ? err.message : String(err)}`,
            });
          }

          if (editionId) {
            await prisma.edition.update({ where: { id: editionId }, data: { announcementsFound: { increment: 1 } } }).catch(() => undefined);
          }
        }
      }
    } catch (err) {
      fatalMessage = err instanceof Error ? err.message : String(err);
      log.push({ at: nowIso(), level: "error", message: `Unhandled adapter error: ${fatalMessage}` });
    }
  }

  const status = fatalMessage
    ? counters.itemsNew + counters.itemsUpdated > 0
      ? "PARTIAL"
      : "FAILED"
    : counters.errorsCount > 0
      ? "PARTIAL"
      : "SUCCEEDED";

  log.push({ at: nowIso(), level: "info", message: `Run finished with status ${status}.` });

  await prisma.sourceRun.update({
    where: { id: sourceRun.id },
    data: { status, finishedAt: new Date(), errorMessage: fatalMessage, log: log as unknown as object, ...counters },
  });

  const reliabilityDelta = status === "SUCCEEDED" ? 3 : status === "PARTIAL" ? -5 : -20;
  await prisma.source.update({
    where: { id: source.id },
    data: {
      lastAttemptedRunAt: new Date(),
      ...(status !== "FAILED" ? { lastSuccessfulRunAt: new Date() } : {}),
      ...(fatalMessage ? { lastErrorAt: new Date(), lastErrorMessage: fatalMessage } : {}),
      reliabilityScore: Math.max(0, Math.min(100, source.reliabilityScore + reliabilityDelta)),
    },
  });

  return { sourceRunId: sourceRun.id, status, ...counters };
}
