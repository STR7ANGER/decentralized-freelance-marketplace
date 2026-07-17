import { z } from "zod";
import type { AuthProfile } from "../auth/repository.js";
import type { DisputeRepository } from "./ports.js";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const cid = z.string().regex(/^(bafy|Qm)[A-Za-z0-9]{20,100}$/);
const openSchema = z.object({
  contractId: z.string().min(1),
  evidenceCid: cid,
  evidenceHash: digest,
  privateNote: z.string().trim().max(2_000).optional(),
});
const resolveSchema = z.object({
  disputeId: z.string().min(1),
  clientAmountMinor: z.string().regex(/^\d+$/).transform(BigInt),
  freelancerAmountMinor: z.string().regex(/^\d+$/).transform(BigInt),
  resolutionHash: digest,
});

export class DisputeError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export class DisputeService {
  constructor(
    private readonly repository: DisputeRepository,
    private readonly telemetry: {
      record(event: Record<string, unknown>): void;
    } = {
      record: () => undefined,
    },
  ) {}

  async open(actor: AuthProfile, raw: unknown, requestId: string) {
    const parsed = openSchema.safeParse(raw);
    if (!parsed.success) throw new DisputeError("INVALID_DISPUTE");
    const contract = await this.repository.contractParticipant(
      actor.tenantId,
      parsed.data.contractId,
      actor.id,
    );
    if (!contract) throw new DisputeError("FORBIDDEN");
    const dispute = await this.repository.create({
      tenantId: actor.tenantId,
      openedById: actor.id,
      contractId: parsed.data.contractId,
      evidenceCid: parsed.data.evidenceCid,
      evidenceHash: parsed.data.evidenceHash,
      ...(parsed.data.privateNote
        ? { privateNote: parsed.data.privateNote }
        : {}),
    });
    if (dispute === "ALREADY_OPEN") throw new DisputeError("DISPUTE_EXISTS");
    await this.repository.audit({
      tenantId: actor.tenantId,
      actorId: actor.id,
      action: "dispute.opened",
      targetId: dispute.id,
      requestId,
    });
    this.telemetry.record({ event: "dispute.opened", disputeId: dispute.id });
    return dispute;
  }

  async resolve(actor: AuthProfile, raw: unknown, requestId: string) {
    if (actor.role !== "RESOLVER" && actor.role !== "ADMIN")
      throw new DisputeError("FORBIDDEN");
    const parsed = resolveSchema.safeParse(raw);
    if (!parsed.success) throw new DisputeError("INVALID_RESOLUTION");
    const dispute = await this.repository.find(
      actor.tenantId,
      parsed.data.disputeId,
    );
    if (!dispute || dispute.status !== "OPEN")
      throw new DisputeError("NOT_OPEN");
    const total =
      parsed.data.clientAmountMinor + parsed.data.freelancerAmountMinor;
    const participant = await this.repository.contractParticipant(
      actor.tenantId,
      dispute.contractId,
      dispute.openedById,
    );
    if (!participant || total <= 0n || total > participant.totalAmountMinor)
      throw new DisputeError("INVALID_RESOLUTION_TOTAL");
    const resolved = await this.repository.resolve({
      tenantId: actor.tenantId,
      resolverId: actor.id,
      ...parsed.data,
    });
    if (resolved === "NOT_OPEN") throw new DisputeError("NOT_OPEN");
    await this.repository.audit({
      tenantId: actor.tenantId,
      actorId: actor.id,
      action: "dispute.resolved",
      targetId: resolved.id,
      requestId,
    });
    this.telemetry.record({
      event: "dispute.resolved",
      disputeId: resolved.id,
    });
    return resolved;
  }

  list(actor: AuthProfile) {
    return this.repository.list(
      actor.tenantId,
      actor.id,
      actor.role === "RESOLVER" || actor.role === "ADMIN",
    );
  }
}
