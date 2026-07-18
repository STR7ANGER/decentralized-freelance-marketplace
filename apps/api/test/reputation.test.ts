import { describe, expect, it } from "vitest";
import type { AuthProfile } from "../src/modules/auth/repository.js";
import {
  type ReputationRepository,
  ReputationService,
} from "../src/modules/reputation/service.js";

class MemoryReputation implements ReputationRepository {
  reviews: Array<{
    id: string;
    rating: number;
    commentHash: string;
    metadataCid: string | null;
    createdAt: Date;
  }> = [];
  async completedCounterparty(
    _tenant: string,
    contract: string,
    reviewer: string,
  ) {
    return contract === "complete" && reviewer === "client"
      ? "freelancer"
      : null;
  }
  async create(input: Parameters<ReputationRepository["create"]>[0]) {
    if (this.reviews.length) return "DUPLICATE" as const;
    const review = {
      id: "review",
      rating: input.rating,
      commentHash: input.commentHash,
      metadataCid: input.metadataCid ?? null,
      createdAt: new Date(),
    };
    this.reviews.push(review);
    return review;
  }
  async forProfile() {
    return {
      count: this.reviews.length,
      average: this.reviews[0]?.rating ?? 0,
      reviews: this.reviews,
    };
  }
}
const actor: AuthProfile = {
  id: "client",
  tenantId: "tenant",
  displayName: "Client",
  role: "CLIENT",
  walletAddress: "client1111111111111111111111111111111111",
};
const input = {
  contractId: "complete",
  rating: 5,
  commentHash: "c".repeat(64),
  metadataCid: `bafy${"d".repeat(40)}`,
};

describe("reputation", () => {
  it("allows one bounded review after a completed contract", async () => {
    const repository = new MemoryReputation();
    const service = new ReputationService(repository);
    await expect(service.submit(actor, input)).resolves.toMatchObject({
      rating: 5,
    });
    await expect(service.submit(actor, input)).rejects.toMatchObject({
      code: "REVIEW_EXISTS",
    });
    await expect(service.get(actor, "freelancer")).resolves.toMatchObject({
      count: 1,
      average: 5,
    });
  });
  it("rejects invalid ratings, hashes, and non-counterparties", async () => {
    const service = new ReputationService(new MemoryReputation());
    await expect(
      service.submit(actor, { ...input, rating: 6 }),
    ).rejects.toMatchObject({ code: "INVALID_REVIEW" });
    await expect(
      service.submit(actor, { ...input, contractId: "active" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
