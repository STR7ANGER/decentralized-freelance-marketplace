import { createHash } from "node:crypto";
import {
  acceptProposalSchema,
  agreeContractSchema,
  messageSchema,
  proposalSchema,
} from "@marketplace/contracts";
import bs58 from "bs58";
import nacl from "tweetnacl";
import type { AuthProfile } from "../auth/repository.js";
import type {
  ContractView,
  MilestoneDraft,
  ProposalRepository,
  ProposalView,
} from "./ports.js";

export class ProposalError extends Error {
  constructor(
    readonly code:
      | "FORBIDDEN"
      | "JOB_CLOSED"
      | "PROPOSAL_EXISTS"
      | "CURRENCY_MISMATCH"
      | "INVALID_MILESTONES"
      | "VERSION_CONFLICT"
      | "NOT_FOUND"
      | "TERMS_MISMATCH"
      | "INVALID_SIGNATURE",
  ) {
    super(code);
  }
}
export type ProposalTelemetry = {
  record(event: {
    name:
      | "proposal.submitted"
      | "proposal.revised"
      | "proposal.accepted"
      | "contract.agreed"
      | "message.sent";
    tenantId: string;
  }): void;
};
const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const canonicalTerms = (input: {
  jobId: string;
  totalAmountMinor: bigint;
  currency: string;
  deliveryDays: number;
  milestones: MilestoneDraft[];
}) =>
  JSON.stringify({
    jobId: input.jobId,
    totalAmountMinor: input.totalAmountMinor.toString(),
    currency: input.currency,
    deliveryDays: input.deliveryDays,
    milestones: input.milestones.map((item, position) => ({
      position,
      title: item.title,
      amountMinor: item.amountMinor.toString(),
      dueAt: item.dueAt.toISOString(),
    })),
  });
const agreementMessage = (contractId: string, termsHash: string) =>
  `Proofwork contract agreement:\nContract: ${contractId}\nTerms SHA-256: ${termsHash}\nThis signature agrees to these terms but does not fund escrow.`;
const serializeProposal = (proposal: ProposalView) => ({
  ...proposal,
  totalAmountMinor: proposal.totalAmountMinor.toString(),
  createdAt: proposal.createdAt.toISOString(),
  milestones: proposal.milestones.map((item) => ({
    ...item,
    amountMinor: item.amountMinor.toString(),
    dueAt: item.dueAt.toISOString(),
  })),
});
const serializeContract = (contract: ContractView) => ({
  ...contract,
  clientAgreedAt: contract.clientAgreedAt?.toISOString() ?? null,
  freelancerAgreedAt: contract.freelancerAgreedAt?.toISOString() ?? null,
});

export class ProposalService {
  constructor(
    private readonly repository: ProposalRepository,
    private readonly telemetry: ProposalTelemetry = { record: () => {} },
    private readonly now = () => new Date(),
  ) {}
  private parseTerms(raw: unknown) {
    const input = proposalSchema.parse(raw);
    const milestones = input.milestones.map((item) => ({
      title: item.title,
      amountMinor: BigInt(item.amountMinor),
      dueAt: new Date(item.dueAt),
    }));
    const total = milestones.reduce((sum, item) => sum + item.amountMinor, 0n);
    const amount = BigInt(input.totalAmountMinor);
    if (
      amount <= 0n ||
      milestones.some((item) => item.amountMinor <= 0n) ||
      total !== amount
    )
      throw new ProposalError("INVALID_MILESTONES");
    const currency = input.currency.toUpperCase();
    const termsHash = sha256(
      canonicalTerms({
        jobId: input.jobId,
        totalAmountMinor: amount,
        currency,
        deliveryDays: input.deliveryDays,
        milestones,
      }),
    );
    return { input, milestones, amount, currency, termsHash };
  }
  async submit(profile: AuthProfile, raw: unknown, requestId: string) {
    if (profile.role !== "FREELANCER") throw new ProposalError("FORBIDDEN");
    const parsed = this.parseTerms(raw);
    const job = await this.repository.jobForProposal(
      profile.tenantId,
      parsed.input.jobId,
    );
    if (!job) throw new ProposalError("NOT_FOUND");
    if (job.status !== "PUBLISHED") throw new ProposalError("JOB_CLOSED");
    if (job.currency !== parsed.currency)
      throw new ProposalError("CURRENCY_MISMATCH");
    const existing = await this.repository.proposalForFreelancer(
      profile.tenantId,
      job.id,
      profile.id,
    );
    let proposal: ProposalView;
    let event: "proposal.submitted" | "proposal.revised";
    if (existing) {
      if (!parsed.input.expectedVersion)
        throw new ProposalError("PROPOSAL_EXISTS");
      const revised = await this.repository.reviseProposal({
        tenantId: profile.tenantId,
        proposalId: existing.id,
        freelancerId: profile.id,
        expectedVersion: parsed.input.expectedVersion,
        coverLetter: parsed.input.coverLetter,
        totalAmountMinor: parsed.amount,
        currency: parsed.currency,
        deliveryDays: parsed.input.deliveryDays,
        termsHash: parsed.termsHash,
        milestones: parsed.milestones,
      });
      if (!revised) throw new ProposalError("VERSION_CONFLICT");
      proposal = revised;
      event = "proposal.revised";
    } else {
      proposal = await this.repository.createProposal({
        tenantId: profile.tenantId,
        jobId: job.id,
        freelancerId: profile.id,
        coverLetter: parsed.input.coverLetter,
        totalAmountMinor: parsed.amount,
        currency: parsed.currency,
        deliveryDays: parsed.input.deliveryDays,
        termsHash: parsed.termsHash,
        milestones: parsed.milestones,
      });
      event = "proposal.submitted";
    }
    await this.repository.audit({
      tenantId: profile.tenantId,
      actorId: profile.id,
      action: event,
      targetType: "Proposal",
      targetId: proposal.id,
      requestId,
    });
    this.telemetry.record({ name: event, tenantId: profile.tenantId });
    return serializeProposal(proposal);
  }
  async compare(profile: AuthProfile, jobId: string) {
    if (profile.role !== "CLIENT" && profile.role !== "ADMIN")
      throw new ProposalError("FORBIDDEN");
    const proposals = await this.repository.proposalsForClient(
      profile.tenantId,
      jobId,
      profile.id,
    );
    if (!proposals) throw new ProposalError("FORBIDDEN");
    return proposals.map(serializeProposal);
  }
  async accept(profile: AuthProfile, raw: unknown, requestId: string) {
    const input = acceptProposalSchema.parse(raw);
    if (profile.role !== "CLIENT" && profile.role !== "ADMIN")
      throw new ProposalError("FORBIDDEN");
    const result = await this.repository.acceptProposal({
      tenantId: profile.tenantId,
      clientId: profile.id,
      proposalId: input.proposalId,
      expectedVersion: input.expectedVersion,
    });
    if (result === "NOT_FOUND") throw new ProposalError("NOT_FOUND");
    if (result === "VERSION_CONFLICT")
      throw new ProposalError("VERSION_CONFLICT");
    await this.repository.audit({
      tenantId: profile.tenantId,
      actorId: profile.id,
      action: "proposal.accepted",
      targetType: "Contract",
      targetId: result.id,
      requestId,
    });
    this.telemetry.record({
      name: "proposal.accepted",
      tenantId: profile.tenantId,
    });
    return serializeContract(result);
  }
  async agree(profile: AuthProfile, raw: unknown, requestId: string) {
    const input = agreeContractSchema.parse(raw);
    const participant = await this.repository.contractParticipant(
      profile.tenantId,
      input.contractId,
      profile.id,
    );
    if (!participant) throw new ProposalError("FORBIDDEN");
    if (participant.contract.termsHash !== input.termsHash)
      throw new ProposalError("TERMS_MISMATCH");
    let valid = false;
    try {
      valid = nacl.sign.detached.verify(
        new TextEncoder().encode(
          agreementMessage(input.contractId, input.termsHash),
        ),
        bs58.decode(input.signature),
        bs58.decode(profile.walletAddress),
      );
    } catch {
      valid = false;
    }
    if (!valid) throw new ProposalError("INVALID_SIGNATURE");
    const contract = await this.repository.agreeContract({
      tenantId: profile.tenantId,
      contractId: input.contractId,
      actorId: profile.id,
      side: participant.side,
      agreedAt: this.now(),
    });
    await this.repository.audit({
      tenantId: profile.tenantId,
      actorId: profile.id,
      action: "contract.agreed",
      targetType: "Contract",
      targetId: contract.id,
      requestId,
    });
    this.telemetry.record({
      name: "contract.agreed",
      tenantId: profile.tenantId,
    });
    return serializeContract(contract);
  }
  async sendMessage(profile: AuthProfile, raw: unknown) {
    const input = messageSchema.parse(raw);
    if (
      !(await this.repository.canMessage(
        profile.tenantId,
        input.jobId,
        input.proposalId,
        profile.id,
      ))
    )
      throw new ProposalError("FORBIDDEN");
    const message = await this.repository.createMessage({
      tenantId: profile.tenantId,
      jobId: input.jobId,
      authorId: profile.id,
      body: input.body,
      ...(input.proposalId ? { proposalId: input.proposalId } : {}),
    });
    this.telemetry.record({ name: "message.sent", tenantId: profile.tenantId });
    return { ...message, createdAt: message.createdAt.toISOString() };
  }
  async messages(
    profile: AuthProfile,
    input: { jobId: string; proposalId?: string; limit?: number },
  ) {
    const messages = await this.repository.messages({
      tenantId: profile.tenantId,
      jobId: input.jobId,
      actorId: profile.id,
      limit: Math.min(Math.max(input.limit ?? 50, 1), 100),
      ...(input.proposalId ? { proposalId: input.proposalId } : {}),
    });
    if (!messages) throw new ProposalError("FORBIDDEN");
    return messages.map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
    }));
  }
}

export const contractAgreementMessage = agreementMessage;
