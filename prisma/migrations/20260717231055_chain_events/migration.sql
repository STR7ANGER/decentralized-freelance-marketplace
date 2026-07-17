-- CreateEnum
CREATE TYPE "ChainConfirmation" AS ENUM ('PROCESSED', 'CONFIRMED', 'FINALIZED', 'FAILED');

-- CreateTable
CREATE TABLE "ChainEvent" (
    "id" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "eventIndex" INTEGER NOT NULL,
    "programId" TEXT NOT NULL,
    "slot" BIGINT NOT NULL,
    "confirmation" "ChainConfirmation" NOT NULL,
    "eventType" TEXT NOT NULL,
    "participantAddresses" TEXT[],
    "payload" JSONB,
    "blockTime" TIMESTAMP(3),
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChainEvent_programId_slot_idx" ON "ChainEvent"("programId", "slot");

-- CreateIndex
CREATE INDEX "ChainEvent_confirmation_updatedAt_idx" ON "ChainEvent"("confirmation", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChainEvent_signature_eventIndex_key" ON "ChainEvent"("signature", "eventIndex");
