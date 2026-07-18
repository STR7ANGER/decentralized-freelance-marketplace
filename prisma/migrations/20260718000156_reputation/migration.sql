-- CreateTable
CREATE TABLE "ReputationReview" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "revieweeId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "commentHash" TEXT NOT NULL,
    "metadataCid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReputationReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReputationReview_tenantId_revieweeId_createdAt_idx" ON "ReputationReview"("tenantId", "revieweeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReputationReview_contractId_reviewerId_key" ON "ReputationReview"("contractId", "reviewerId");

-- AddForeignKey
ALTER TABLE "ReputationReview" ADD CONSTRAINT "ReputationReview_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
