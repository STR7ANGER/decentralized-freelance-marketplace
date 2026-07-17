-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "evidenceCid" TEXT NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "privateNote" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolverId" TEXT,
    "clientAmountMinor" BIGINT,
    "freelancerAmountMinor" BIGINT,
    "resolutionHash" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dispute_tenantId_status_createdAt_idx" ON "Dispute"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Dispute_contractId_createdAt_idx" ON "Dispute"("contractId", "createdAt");

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
