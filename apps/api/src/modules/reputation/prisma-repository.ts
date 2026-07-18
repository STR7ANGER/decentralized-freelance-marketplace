import { prisma } from "../../db.js";
import type { ReputationRepository } from "./service.js";

const reviewSelect = {
  id: true,
  rating: true,
  commentHash: true,
  metadataCid: true,
  createdAt: true,
} as const;
export class PrismaReputationRepository implements ReputationRepository {
  async completedCounterparty(
    tenantId: string,
    contractId: string,
    reviewerId: string,
  ) {
    const row = await prisma.contract.findFirst({
      where: { id: contractId, tenantId, status: "COMPLETED" },
      select: {
        proposal: {
          select: { freelancerId: true, job: { select: { clientId: true } } },
        },
      },
    });
    if (!row) return null;
    if (row.proposal.freelancerId === reviewerId)
      return row.proposal.job.clientId;
    if (row.proposal.job.clientId === reviewerId)
      return row.proposal.freelancerId;
    return null;
  }
  async create(input: Parameters<ReputationRepository["create"]>[0]) {
    try {
      return await prisma.reputationReview.create({
        data: input,
        select: reviewSelect,
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error &&
        "code" in error &&
        error.code === "P2002"
      )
        return "DUPLICATE" as const;
      throw error;
    }
  }
  async forProfile(tenantId: string, profileId: string) {
    const reviews = await prisma.reputationReview.findMany({
      where: { tenantId, revieweeId: profileId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: reviewSelect,
    });
    return {
      count: reviews.length,
      average: reviews.length
        ? reviews.reduce((sum, review) => sum + review.rating, 0) /
          reviews.length
        : 0,
      reviews,
    };
  }
}
