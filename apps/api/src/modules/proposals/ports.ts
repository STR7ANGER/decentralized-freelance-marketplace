export type MilestoneDraft = {
  title: string;
  amountMinor: bigint;
  dueAt: Date;
};
export type ProposalView = {
  id: string;
  jobId: string;
  freelancerId: string;
  freelancerName: string;
  coverLetter: string;
  totalAmountMinor: bigint;
  currency: string;
  deliveryDays: number;
  status: string;
  version: number;
  termsHash: string;
  milestones: MilestoneDraft[];
  createdAt: Date;
};
export type ContractView = {
  id: string;
  proposalId: string;
  status: string;
  version: number;
  termsHash: string;
  clientAgreedAt: Date | null;
  freelancerAgreedAt: Date | null;
};
export type MessageView = {
  id: string;
  jobId: string;
  proposalId: string | null;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: Date;
};

export interface ProposalRepository {
  jobForProposal(
    tenantId: string,
    jobId: string,
  ): Promise<{
    id: string;
    clientId: string;
    status: string;
    currency: string;
  } | null>;
  proposalForFreelancer(
    tenantId: string,
    jobId: string,
    freelancerId: string,
  ): Promise<ProposalView | null>;
  createProposal(input: {
    tenantId: string;
    jobId: string;
    freelancerId: string;
    coverLetter: string;
    totalAmountMinor: bigint;
    currency: string;
    deliveryDays: number;
    termsHash: string;
    milestones: MilestoneDraft[];
  }): Promise<ProposalView>;
  reviseProposal(input: {
    tenantId: string;
    proposalId: string;
    freelancerId: string;
    expectedVersion: number;
    coverLetter: string;
    totalAmountMinor: bigint;
    currency: string;
    deliveryDays: number;
    termsHash: string;
    milestones: MilestoneDraft[];
  }): Promise<ProposalView | null>;
  proposalsForClient(
    tenantId: string,
    jobId: string,
    clientId: string,
  ): Promise<ProposalView[] | null>;
  acceptProposal(input: {
    tenantId: string;
    clientId: string;
    proposalId: string;
    expectedVersion: number;
  }): Promise<ContractView | "NOT_FOUND" | "VERSION_CONFLICT">;
  contractParticipant(
    tenantId: string,
    contractId: string,
    actorId: string,
  ): Promise<{ contract: ContractView; side: "CLIENT" | "FREELANCER" } | null>;
  agreeContract(input: {
    tenantId: string;
    contractId: string;
    actorId: string;
    side: "CLIENT" | "FREELANCER";
    agreedAt: Date;
  }): Promise<ContractView>;
  canMessage(
    tenantId: string,
    jobId: string,
    proposalId: string | undefined,
    actorId: string,
  ): Promise<boolean>;
  createMessage(input: {
    tenantId: string;
    jobId: string;
    proposalId?: string;
    authorId: string;
    body: string;
  }): Promise<MessageView>;
  messages(input: {
    tenantId: string;
    jobId: string;
    proposalId?: string;
    actorId: string;
    limit: number;
  }): Promise<MessageView[] | null>;
  audit(input: {
    tenantId: string;
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    requestId: string;
  }): Promise<void>;
}
