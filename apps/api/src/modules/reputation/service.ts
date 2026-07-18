import { z } from "zod";
import type { AuthProfile } from "../auth/repository.js";

export type ReputationView = {
  count: number;
  average: number;
  reviews: Array<{
    id: string;
    rating: number;
    commentHash: string;
    metadataCid: string | null;
    createdAt: Date;
  }>;
};
export interface ReputationRepository {
  completedCounterparty(
    tenantId: string,
    contractId: string,
    reviewerId: string,
  ): Promise<string | null>;
  create(input: {
    tenantId: string;
    contractId: string;
    reviewerId: string;
    revieweeId: string;
    rating: number;
    commentHash: string;
    metadataCid?: string;
  }): Promise<
    | "DUPLICATE"
    | {
        id: string;
        rating: number;
        commentHash: string;
        metadataCid: string | null;
        createdAt: Date;
      }
  >;
  forProfile(tenantId: string, profileId: string): Promise<ReputationView>;
}

const schema = z.object({
  contractId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  commentHash: z.string().regex(/^[a-f0-9]{64}$/),
  metadataCid: z
    .string()
    .regex(/^(bafy|Qm)[A-Za-z0-9]{20,100}$/)
    .optional(),
});
export class ReputationError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export class ReputationService {
  constructor(
    private readonly repository: ReputationRepository,
    private readonly telemetry: {
      record(event: Record<string, unknown>): void;
    } = { record: () => undefined },
  ) {}
  async submit(actor: AuthProfile, raw: unknown) {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) throw new ReputationError("INVALID_REVIEW");
    const revieweeId = await this.repository.completedCounterparty(
      actor.tenantId,
      parsed.data.contractId,
      actor.id,
    );
    if (!revieweeId) throw new ReputationError("FORBIDDEN");
    const review = await this.repository.create({
      tenantId: actor.tenantId,
      reviewerId: actor.id,
      revieweeId,
      contractId: parsed.data.contractId,
      rating: parsed.data.rating,
      commentHash: parsed.data.commentHash,
      ...(parsed.data.metadataCid
        ? { metadataCid: parsed.data.metadataCid }
        : {}),
    });
    if (review === "DUPLICATE") throw new ReputationError("REVIEW_EXISTS");
    this.telemetry.record({
      event: "reputation.review_created",
      rating: review.rating,
    });
    return review;
  }
  get(actor: AuthProfile, profileId: string) {
    return this.repository.forProfile(actor.tenantId, profileId);
  }
}
