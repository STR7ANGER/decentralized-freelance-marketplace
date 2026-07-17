import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import type { DisputeRepository } from "./ports.js";

const select = {
  id: true,
  contractId: true,
  openedById: true,
  evidenceCid: true,
  evidenceHash: true,
  status: true,
  resolverId: true,
  clientAmountMinor: true,
  freelancerAmountMinor: true,
  resolutionHash: true,
  createdAt: true,
  resolvedAt: true,
} as const;

export class PrismaDisputeRepository implements DisputeRepository {
  async contractParticipant(
    tenantId: string,
    contractId: string,
    profileId: string,
  ) {
    const row = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: {
        proposal: {
          select: {
            freelancerId: true,
            totalAmountMinor: true,
            job: { select: { clientId: true } },
          },
        },
      },
    });
    if (!row) return null;
    const side =
      row.proposal.job.clientId === profileId
        ? ("CLIENT" as const)
        : row.proposal.freelancerId === profileId
          ? ("FREELANCER" as const)
          : null;
    return side
      ? { side, totalAmountMinor: row.proposal.totalAmountMinor }
      : null;
  }

  async create(input: Parameters<DisputeRepository["create"]>[0]) {
    const open = await prisma.dispute.findFirst({
      where: { contractId: input.contractId, status: "OPEN" },
      select: { id: true },
    });
    if (open) return "ALREADY_OPEN" as const;
    return prisma.dispute.create({ data: input, select });
  }

  find(tenantId: string, disputeId: string) {
    return prisma.dispute.findFirst({
      where: { id: disputeId, tenantId },
      select,
    });
  }

  async resolve(input: Parameters<DisputeRepository["resolve"]>[0]) {
    const result = await prisma.dispute.updateMany({
      where: { id: input.disputeId, tenantId: input.tenantId, status: "OPEN" },
      data: {
        status: "RESOLVED",
        resolverId: input.resolverId,
        clientAmountMinor: input.clientAmountMinor,
        freelancerAmountMinor: input.freelancerAmountMinor,
        resolutionHash: input.resolutionHash,
        resolvedAt: new Date(),
      },
    });
    if (result.count !== 1) return "NOT_OPEN" as const;
    const row = await this.find(input.tenantId, input.disputeId);
    if (!row) return "NOT_OPEN" as const;
    return row;
  }

  list(tenantId: string, profileId: string, resolver: boolean) {
    return prisma.dispute.findMany({
      where: {
        tenantId,
        ...(resolver
          ? {}
          : {
              contract: {
                proposal: {
                  OR: [
                    { freelancerId: profileId },
                    { job: { clientId: profileId } },
                  ],
                },
              },
            }),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select,
    });
  }

  async audit(input: Parameters<DisputeRepository["audit"]>[0]) {
    await prisma.auditEvent.create({
      data: { ...input, targetType: "Dispute", metadata: Prisma.JsonNull },
    });
  }
}
