-- CreateEnum
CREATE TYPE "ProfileRole" AS ENUM ('CLIENT', 'FREELANCER', 'RESOLVER', 'ADMIN');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('SUBMITTED', 'SHORTLISTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('NEGOTIATING', 'AGREED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PROPOSED', 'AGREED', 'FUNDED', 'SUBMITTED', 'APPROVED', 'RELEASED', 'DISPUTED', 'REFUNDED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "role" "ProfileRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "cluster" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletNonce" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "nonceHash" TEXT NOT NULL,
    "messageHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletNonce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "skills" TEXT[],
    "budgetMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "coverLetter" TEXT NOT NULL,
    "totalAmountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "deliveryDays" INTEGER NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'SUBMITTED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'NEGOTIATING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PROPOSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "requestId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "UserProfile_tenantId_role_idx" ON "UserProfile"("tenantId", "role");

-- CreateIndex
CREATE INDEX "Wallet_profileId_idx" ON "Wallet"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_cluster_address_key" ON "Wallet"("cluster", "address");

-- CreateIndex
CREATE INDEX "WalletNonce_tenantId_address_expiresAt_idx" ON "WalletNonce"("tenantId", "address", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_profileId_expiresAt_idx" ON "Session"("profileId", "expiresAt");

-- CreateIndex
CREATE INDEX "Job_tenantId_status_createdAt_idx" ON "Job"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Job_tenantId_category_budgetMinor_idx" ON "Job"("tenantId", "category", "budgetMinor");

-- CreateIndex
CREATE INDEX "Proposal_tenantId_jobId_status_idx" ON "Proposal"("tenantId", "jobId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_jobId_freelancerId_key" ON "Proposal"("jobId", "freelancerId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_proposalId_key" ON "Contract"("proposalId");

-- CreateIndex
CREATE INDEX "Contract_tenantId_status_idx" ON "Contract"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_contractId_position_key" ON "Milestone"("contractId", "position");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_createdAt_idx" ON "AuditEvent"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletNonce" ADD CONSTRAINT "WalletNonce_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
