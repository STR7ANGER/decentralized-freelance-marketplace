import { describe, expect, it } from "vitest";
import type { AuthProfile } from "../src/modules/auth/repository.js";
import type {
  DisputeRepository,
  DisputeView,
} from "../src/modules/disputes/ports.js";
import { DisputeService } from "../src/modules/disputes/service.js";

class MemoryDisputes implements DisputeRepository {
  dispute?: DisputeView;
  auditActions: string[] = [];
  async contractParticipant(
    _tenant: string,
    contractId: string,
    profileId: string,
  ) {
    return contractId === "contract" &&
      ["client", "freelancer"].includes(profileId)
      ? {
          side:
            profileId === "client"
              ? ("CLIENT" as const)
              : ("FREELANCER" as const),
          totalAmountMinor: 1_000n,
        }
      : null;
  }
  async create(input: Parameters<DisputeRepository["create"]>[0]) {
    if (this.dispute?.status === "OPEN") return "ALREADY_OPEN" as const;
    this.dispute = {
      id: "dispute",
      status: "OPEN",
      resolverId: null,
      clientAmountMinor: null,
      freelancerAmountMinor: null,
      resolutionHash: null,
      createdAt: new Date(),
      resolvedAt: null,
      ...input,
    };
    return this.dispute;
  }
  async find() {
    return this.dispute ?? null;
  }
  async resolve(input: Parameters<DisputeRepository["resolve"]>[0]) {
    if (!this.dispute || this.dispute.status !== "OPEN")
      return "NOT_OPEN" as const;
    this.dispute = {
      ...this.dispute,
      ...input,
      status: "RESOLVED",
      resolvedAt: new Date(),
    };
    return this.dispute;
  }
  async list() {
    return this.dispute ? [this.dispute] : [];
  }
  async audit(input: Parameters<DisputeRepository["audit"]>[0]) {
    this.auditActions.push(input.action);
  }
}

const profile = (id: string, role: AuthProfile["role"]): AuthProfile => ({
  id,
  tenantId: "tenant",
  displayName: id,
  role,
  walletAddress: `${id}1111111111111111111111111111111111`,
});
const evidence = {
  contractId: "contract",
  evidenceCid: `bafy${"a".repeat(40)}`,
  evidenceHash: "a".repeat(64),
  privateNote: "Private context for resolver",
};

describe("dispute service", () => {
  it("allows participants to open one content-addressed dispute without logging notes", async () => {
    const repository = new MemoryDisputes();
    const events: Array<Record<string, unknown>> = [];
    const service = new DisputeService(repository, {
      record: (event) => events.push(event),
    });
    await expect(
      service.open(profile("client", "CLIENT"), evidence, "request"),
    ).resolves.toMatchObject({ status: "OPEN" });
    await expect(
      service.open(profile("client", "CLIENT"), evidence, "request"),
    ).rejects.toMatchObject({ code: "DISPUTE_EXISTS" });
    expect(JSON.stringify(events)).not.toContain(evidence.privateNote);
  });

  it("requires resolver role and exact award conservation", async () => {
    const repository = new MemoryDisputes();
    const service = new DisputeService(repository);
    await service.open(
      profile("freelancer", "FREELANCER"),
      evidence,
      "request",
    );
    const input = {
      disputeId: "dispute",
      clientAmountMinor: "400",
      freelancerAmountMinor: "600",
      resolutionHash: "b".repeat(64),
    };
    await expect(
      service.resolve(profile("client", "CLIENT"), input, "request"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      service.resolve(
        profile("resolver", "RESOLVER"),
        { ...input, freelancerAmountMinor: "601" },
        "request",
      ),
    ).rejects.toMatchObject({ code: "INVALID_RESOLUTION_TOTAL" });
    await expect(
      service.resolve(profile("resolver", "RESOLVER"), input, "request"),
    ).resolves.toMatchObject({ status: "RESOLVED" });
  });

  it("rejects outsiders and malformed evidence", async () => {
    const service = new DisputeService(new MemoryDisputes());
    await expect(
      service.open(profile("outsider", "CLIENT"), evidence, "request"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      service.open(
        profile("client", "CLIENT"),
        { ...evidence, evidenceHash: "no" },
        "request",
      ),
    ).rejects.toMatchObject({ code: "INVALID_DISPUTE" });
  });
});
