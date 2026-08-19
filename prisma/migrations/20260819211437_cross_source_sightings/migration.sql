-- CreateTable
CREATE TABLE "TenderSourceSighting" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "announcementUrl" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenderSourceSighting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenderSourceSighting_tenderId_sourceId_key" ON "TenderSourceSighting"("tenderId", "sourceId");

-- AddForeignKey
ALTER TABLE "TenderSourceSighting" ADD CONSTRAINT "TenderSourceSighting_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderSourceSighting" ADD CONSTRAINT "TenderSourceSighting_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
