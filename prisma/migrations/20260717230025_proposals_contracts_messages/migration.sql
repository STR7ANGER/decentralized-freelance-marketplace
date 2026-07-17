/*
  Warnings:

  - Added the required column `termsHash` to the `Contract` table without a default value. This is not possible if the table is not empty.
  - Added the required column `milestoneDraft` to the `Proposal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `termsHash` to the `Proposal` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "clientAgreedAt" TIMESTAMP(3),
ADD COLUMN     "freelancerAgreedAt" TIMESTAMP(3),
ADD COLUMN     "termsHash" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Proposal" ADD COLUMN     "milestoneDraft" JSONB NOT NULL,
ADD COLUMN     "termsHash" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "ProposalRevision" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "coverLetter" TEXT NOT NULL,
    "totalAmountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "deliveryDays" INTEGER NOT NULL,
    "termsHash" TEXT NOT NULL,
    "milestoneDraft" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "proposalId" TEXT,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProposalRevision_proposalId_version_key" ON "ProposalRevision"("proposalId", "version");

-- CreateIndex
CREATE INDEX "JobMessage_tenantId_jobId_createdAt_idx" ON "JobMessage"("tenantId", "jobId", "createdAt");

-- CreateIndex
CREATE INDEX "JobMessage_proposalId_createdAt_idx" ON "JobMessage"("proposalId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProposalRevision" ADD CONSTRAINT "ProposalRevision_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMessage" ADD CONSTRAINT "JobMessage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMessage" ADD CONSTRAINT "JobMessage_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMessage" ADD CONSTRAINT "JobMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
