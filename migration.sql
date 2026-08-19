-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'REVIEWER');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('NEWSPAPER_FLIPBOOK', 'GOVERNMENT_PORTAL', 'DEVELOPMENT_BANK', 'UN_AGENCY', 'NGO', 'MUNICIPALITY', 'AGGREGATOR', 'DEMO', 'OTHER');

-- CreateEnum
CREATE TYPE "SourceRunTrigger" AS ENUM ('MANUAL', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "SourceRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "EditionStatus" AS ENUM ('DISCOVERED', 'QUEUED', 'DOWNLOADING', 'DOWNLOADED', 'PROCESSING', 'PROCESSED', 'FAILED', 'REQUIRES_REVIEW');

-- CreateEnum
CREATE TYPE "TenderStatus" AS ENUM ('NEW', 'REVIEWING', 'PURSUING', 'SUBMITTED', 'WON', 'LOST', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "Classification" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NOT_RELEVANT');

-- CreateEnum
CREATE TYPE "ProvenanceConfidence" AS ENUM ('CONFIRMED', 'INFERRED', 'AI_GENERATED');

-- CreateEnum
CREATE TYPE "EmailPurpose" AS ENUM ('CLARIFICATION', 'REQUEST_DOCUMENTS', 'EXPRESS_INTEREST', 'ELIGIBILITY', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'REVIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "authRequired" BOOLEAN NOT NULL DEFAULT false,
    "adapterKey" TEXT NOT NULL,
    "schedule" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "reliabilityScore" INTEGER NOT NULL DEFAULT 100,
    "lastSuccessfulRunAt" TIMESTAMP(3),
    "lastAttemptedRunAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "SourceRunStatus" NOT NULL DEFAULT 'QUEUED',
    "trigger" "SourceRunTrigger" NOT NULL DEFAULT 'MANUAL',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "editionsScanned" INTEGER NOT NULL DEFAULT 0,
    "itemsDiscovered" INTEGER NOT NULL DEFAULT 0,
    "itemsNew" INTEGER NOT NULL DEFAULT 0,
    "itemsUpdated" INTEGER NOT NULL DEFAULT 0,
    "itemsDuplicate" INTEGER NOT NULL DEFAULT 0,
    "itemsIrrelevant" INTEGER NOT NULL DEFAULT 0,
    "errorsCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "log" JSONB NOT NULL DEFAULT '[]',
    "triggeredById" TEXT,

    CONSTRAINT "SourceRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Edition" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "publicationDate" TIMESTAMP(3) NOT NULL,
    "url" TEXT NOT NULL,
    "status" "EditionStatus" NOT NULL DEFAULT 'DISCOVERED',
    "pageCount" INTEGER,
    "announcementsFound" INTEGER NOT NULL DEFAULT 0,
    "checksum" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "Edition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "sector" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tender" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "editionId" TEXT,
    "externalRef" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "announcementUrl" TEXT,
    "organizationId" TEXT,
    "organizationRaw" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categoryTags" TEXT[],
    "geography" TEXT,
    "estimatedValue" DECIMAL(18,2),
    "currency" TEXT,
    "contractDuration" TEXT,
    "procurementMethod" TEXT,
    "tenderType" TEXT,
    "publicationDate" TIMESTAMP(3),
    "sourcePublicationDate" TIMESTAMP(3),
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline" TIMESTAMP(3),
    "clarificationDeadline" TIMESTAMP(3),
    "submissionDeadline" TIMESTAMP(3),
    "openingDate" TIMESTAMP(3),
    "eligibilityRequirements" TEXT[],
    "requiredQualifications" TEXT[],
    "requiredExperience" TEXT[],
    "requiredDocuments" TEXT[],
    "financialRequirements" TEXT,
    "technicalRequirements" TEXT,
    "consortiumNotes" TEXT,
    "relevanceScore" INTEGER NOT NULL DEFAULT 0,
    "confidenceScore" INTEGER NOT NULL DEFAULT 0,
    "classification" "Classification" NOT NULL DEFAULT 'LOW',
    "matchingCapabilities" TEXT[],
    "classificationReasons" TEXT[],
    "risks" TEXT[],
    "missingInformation" TEXT[],
    "aiSummary" TEXT,
    "recommendedAction" TEXT,
    "status" "TenderStatus" NOT NULL DEFAULT 'NEW',
    "assignedToId" TEXT,
    "watchlisted" BOOLEAN NOT NULL DEFAULT false,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TIMESTAMP(3),
    "dedupeKey" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "duplicateOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderFieldProvenance" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "confidence" "ProvenanceConfidence" NOT NULL,
    "sourceDescription" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenderFieldProvenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderDocument" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "storagePath" TEXT,
    "fileType" TEXT,
    "fileSizeBytes" INTEGER,
    "documentHash" TEXT,
    "downloadedAt" TIMESTAMP(3),
    "extractedText" TEXT,
    "ocrApplied" BOOLEAN NOT NULL DEFAULT false,
    "ocrStatus" TEXT NOT NULL DEFAULT 'NOT_NEEDED',
    "parsingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenderDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderVersion" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "sourceRunId" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenderVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderChange" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "fieldName" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "description" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenderChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDraft" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "purpose" "EmailPurpose" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "groundedFields" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "EmailDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HumanFeedback" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feedbackType" TEXT NOT NULL,
    "previousScore" INTEGER,
    "correctedScore" INTEGER,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HumanFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tenderId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Source_key_key" ON "Source"("key");

-- CreateIndex
CREATE INDEX "SourceRun_sourceId_startedAt_idx" ON "SourceRun"("sourceId", "startedAt");

-- CreateIndex
CREATE INDEX "Edition_sourceId_publicationDate_idx" ON "Edition"("sourceId", "publicationDate");

-- CreateIndex
CREATE UNIQUE INDEX "Edition_sourceId_externalId_key" ON "Edition"("sourceId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_normalizedName_key" ON "Organization"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Tender_status_idx" ON "Tender"("status");

-- CreateIndex
CREATE INDEX "Tender_classification_idx" ON "Tender"("classification");

-- CreateIndex
CREATE INDEX "Tender_relevanceScore_idx" ON "Tender"("relevanceScore");

-- CreateIndex
CREATE INDEX "Tender_deadline_idx" ON "Tender"("deadline");

-- CreateIndex
CREATE INDEX "Tender_watchlisted_idx" ON "Tender"("watchlisted");

-- CreateIndex
CREATE INDEX "Tender_dedupeKey_idx" ON "Tender"("dedupeKey");

-- CreateIndex
CREATE INDEX "Tender_sourceId_idx" ON "Tender"("sourceId");

-- CreateIndex
CREATE INDEX "TenderFieldProvenance_tenderId_fieldName_idx" ON "TenderFieldProvenance"("tenderId", "fieldName");

-- CreateIndex
CREATE INDEX "TenderDocument_tenderId_idx" ON "TenderDocument"("tenderId");

-- CreateIndex
CREATE UNIQUE INDEX "TenderVersion_tenderId_versionNumber_key" ON "TenderVersion"("tenderId", "versionNumber");

-- CreateIndex
CREATE INDEX "TenderChange_tenderId_detectedAt_idx" ON "TenderChange"("tenderId", "detectedAt");

-- CreateIndex
CREATE INDEX "Note_tenderId_idx" ON "Note"("tenderId");

-- CreateIndex
CREATE INDEX "Activity_tenderId_createdAt_idx" ON "Activity"("tenderId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailDraft_tenderId_idx" ON "EmailDraft"("tenderId");

-- CreateIndex
CREATE INDEX "HumanFeedback_tenderId_idx" ON "HumanFeedback"("tenderId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- AddForeignKey
ALTER TABLE "SourceRun" ADD CONSTRAINT "SourceRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Edition" ADD CONSTRAINT "Edition_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Tender"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderFieldProvenance" ADD CONSTRAINT "TenderFieldProvenance_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderDocument" ADD CONSTRAINT "TenderDocument_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderVersion" ADD CONSTRAINT "TenderVersion_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderChange" ADD CONSTRAINT "TenderChange_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDraft" ADD CONSTRAINT "EmailDraft_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDraft" ADD CONSTRAINT "EmailDraft_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HumanFeedback" ADD CONSTRAINT "HumanFeedback_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HumanFeedback" ADD CONSTRAINT "HumanFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
