import bs58 from "bs58";
import nacl from "tweetnacl";
import { describe, expect, it } from "vitest";
import type { AuthProfile } from "../src/modules/auth/repository.js";
import type {
  ContractView,
  MessageView,
  MilestoneDraft,
  ProposalRepository,
  ProposalView,
} from "../src/modules/proposals/ports.js";
import {
  contractAgreementMessage,
  ProposalService,
} from "../src/modules/proposals/service.js";

class MemoryProposalRepository implements ProposalRepository {
  proposal?: ProposalView;
  contract?: ContractView;
  messagesStore: MessageView[] = [];
  audits: string[] = [];
  async jobForProposal(_tenantId: string, jobId: string) {
    return jobId === "job-1"
      ? {
          id: jobId,
          clientId: "client-1",
          status: "PUBLISHED",
          currency: "USD",
        }
      : null;
  }
  async proposalForFreelancer() {
    return this.proposal ?? null;
  }
  async createProposal(input: {
    jobId: string;
    freelancerId: string;
    coverLetter: string;
    totalAmountMinor: bigint;
    currency: string;
    deliveryDays: number;
    termsHash: string;
    milestones: MilestoneDraft[];
  }) {
    this.proposal = {
      id: "proposal-1",
      freelancerName: "Freelancer",
      status: "SUBMITTED",
      version: 1,
      createdAt: new Date("2026-07-18"),
      ...input,
    };
    return this.proposal;
  }
  async reviseProposal(input: {
    expectedVersion: number;
    coverLetter: string;
    totalAmountMinor: bigint;
    currency: string;
    deliveryDays: number;
    termsHash: string;
    milestones: MilestoneDraft[];
  }) {
    if (!this.proposal || this.proposal.version !== input.expectedVersion)
      return null;
    this.proposal = {
      ...this.proposal,
      ...input,
      version: input.expectedVersion + 1,
    };
    return this.proposal;
  }
  async proposalsForClient(
    _tenantId: string,
    _jobId: string,
    clientId: string,
  ) {
    return clientId === "client-1"
      ? this.proposal
        ? [this.proposal]
        : []
      : null;
  }
  async acceptProposal(input: { expectedVersion: number }) {
    if (!this.proposal) return "NOT_FOUND" as const;
    if (this.proposal.version !== input.expectedVersion)
      return "VERSION_CONFLICT" as const;
    this.contract = {
      id: "contract-1",
      proposalId: this.proposal.id,
      status: "NEGOTIATING",
      version: 1,
      termsHash: this.proposal.termsHash,
      clientAgreedAt: null,
      freelancerAgreedAt: null,
    };
    return this.contract;
  }
  async contractParticipant(
    _tenantId: string,
    _contractId: string,
    actorId: string,
  ) {
    if (!this.contract) return null;
    const side =
      actorId === "client-1"
        ? ("CLIENT" as const)
        : actorId === "freelancer-1"
          ? ("FREELANCER" as const)
          : null;
    return side ? { contract: this.contract, side } : null;
  }
  async agreeContract(input: {
    side: "CLIENT" | "FREELANCER";
    agreedAt: Date;
  }) {
    if (!this.contract) throw new Error("missing contract");
    this.contract = {
      ...this.contract,
      ...(input.side === "CLIENT"
        ? { clientAgreedAt: input.agreedAt }
        : { freelancerAgreedAt: input.agreedAt }),
    };
    if (this.contract.clientAgreedAt && this.contract.freelancerAgreedAt)
      this.contract = { ...this.contract, status: "AGREED", version: 2 };
    return this.contract;
  }
  async canMessage(
    _tenantId: string,
    _jobId: string,
    proposalId: string | undefined,
    actorId: string,
  ) {
    return (
      proposalId === "proposal-1" &&
      ["client-1", "freelancer-1"].includes(actorId)
    );
  }
  async createMessage(input: {
    jobId: string;
    proposalId?: string;
    authorId: string;
    body: string;
  }) {
    const message = {
      id: "message-1",
      jobId: input.jobId,
      proposalId: input.proposalId ?? null,
      authorId: input.authorId,
      authorName: "Member",
      body: input.body,
      createdAt: new Date("2026-07-18"),
    };
    this.messagesStore.push(message);
    return message;
  }
  async messages(input: { actorId: string }) {
    return ["client-1", "freelancer-1"].includes(input.actorId)
      ? this.messagesStore
      : null;
  }
  async audit(input: { action: string }) {
    this.audits.push(input.action);
  }
}

const clientKeys = nacl.sign.keyPair();
const freelancerKeys = nacl.sign.keyPair();
const client: AuthProfile = {
  id: "client-1",
  tenantId: "tenant-1",
  displayName: "Client",
  role: "CLIENT",
  walletAddress: bs58.encode(clientKeys.publicKey),
};
const freelancer: AuthProfile = {
  id: "freelancer-1",
  tenantId: "tenant-1",
  displayName: "Freelancer",
  role: "FREELANCER",
  walletAddress: bs58.encode(freelancerKeys.publicKey),
};
const proposalInput = {
  jobId: "job-1",
  coverLetter:
    "I can deliver this work with reviewed milestones and deterministic tests.",
  totalAmountMinor: "30000",
  currency: "usd",
  deliveryDays: 14,
  milestones: [
    {
      title: "Foundation",
      amountMinor: "10000",
      dueAt: "2026-08-01T00:00:00.000Z",
    },
    {
      title: "Delivery",
      amountMinor: "20000",
      dueAt: "2026-08-14T00:00:00.000Z",
    },
  ],
};

describe("proposal and contract negotiation", () => {
  it("submits and version-revises canonical milestone terms", async () => {
    const repository = new MemoryProposalRepository();
    const events: Array<Record<string, unknown>> = [];
    const service = new ProposalService(repository, {
      record: (event) => events.push(event),
    });
    const created = await service.submit(
      freelancer,
      proposalInput,
      "request-1",
    );
    expect(created).toMatchObject({
      version: 1,
      totalAmountMinor: "30000",
      currency: "USD",
    });
    expect(created.termsHash).toMatch(/^[a-f0-9]{64}$/);
    const revised = await service.submit(
      freelancer,
      {
        ...proposalInput,
        expectedVersion: 1,
        coverLetter:
          "I can deliver the revised work with reviewed milestones and deterministic tests.",
      },
      "request-2",
    );
    expect(revised.version).toBe(2);
    await expect(
      service.submit(
        freelancer,
        { ...proposalInput, expectedVersion: 1 },
        "request-3",
      ),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    expect(JSON.stringify(events)).not.toContain("coverLetter");
  });
  it("rejects invalid totals, currencies, and roles", async () => {
    const service = new ProposalService(new MemoryProposalRepository());
    await expect(
      service.submit(client, proposalInput, "request"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      service.submit(
        freelancer,
        { ...proposalInput, totalAmountMinor: "30001" },
        "request",
      ),
    ).rejects.toMatchObject({ code: "INVALID_MILESTONES" });
    await expect(
      service.submit(
        freelancer,
        { ...proposalInput, currency: "EUR" },
        "request",
      ),
    ).rejects.toMatchObject({ code: "CURRENCY_MISMATCH" });
  });
  it("accepts once, verifies both wallet agreement signatures, and isolates messages", async () => {
    const repository = new MemoryProposalRepository();
    const service = new ProposalService(
      repository,
      undefined,
      () => new Date("2026-07-18"),
    );
    const proposal = await service.submit(freelancer, proposalInput, "request");
    const contract = await service.accept(
      client,
      { proposalId: proposal.id, expectedVersion: 1 },
      "request",
    );
    const sign = (keys: nacl.SignKeyPair) =>
      bs58.encode(
        nacl.sign.detached(
          new TextEncoder().encode(
            contractAgreementMessage(contract.id, contract.termsHash),
          ),
          keys.secretKey,
        ),
      );
    await expect(
      service.agree(
        client,
        {
          contractId: contract.id,
          termsHash: contract.termsHash,
          signature: sign(clientKeys),
        },
        "request",
      ),
    ).resolves.toMatchObject({ status: "NEGOTIATING" });
    await expect(
      service.agree(
        freelancer,
        {
          contractId: contract.id,
          termsHash: contract.termsHash,
          signature: sign(freelancerKeys),
        },
        "request",
      ),
    ).resolves.toMatchObject({ status: "AGREED", version: 2 });
    await service.sendMessage(freelancer, {
      jobId: "job-1",
      proposalId: "proposal-1",
      body: "The milestone details are ready.",
    });
    await expect(
      service.messages(client, { jobId: "job-1", proposalId: "proposal-1" }),
    ).resolves.toMatchObject([{ body: "The milestone details are ready." }]);
    await expect(
      service.messages(
        { ...client, id: "outsider" },
        { jobId: "job-1", proposalId: "proposal-1" },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
