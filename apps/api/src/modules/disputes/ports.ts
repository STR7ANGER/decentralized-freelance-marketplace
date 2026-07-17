export type DisputeView = {
  id: string;
  contractId: string;
  openedById: string;
  evidenceCid: string;
  evidenceHash: string;
  status: string;
  resolverId: string | null;
  clientAmountMinor: bigint | null;
  freelancerAmountMinor: bigint | null;
  resolutionHash: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
};

export interface DisputeRepository {
  contractParticipant(
    tenantId: string,
    contractId: string,
    profileId: string,
  ): Promise<{
    side: "CLIENT" | "FREELANCER";
    totalAmountMinor: bigint;
  } | null>;
  create(input: {
    tenantId: string;
    contractId: string;
    openedById: string;
    evidenceCid: string;
    evidenceHash: string;
    privateNote?: string;
  }): Promise<DisputeView | "ALREADY_OPEN">;
  find(tenantId: string, disputeId: string): Promise<DisputeView | null>;
  resolve(input: {
    tenantId: string;
    disputeId: string;
    resolverId: string;
    clientAmountMinor: bigint;
    freelancerAmountMinor: bigint;
    resolutionHash: string;
  }): Promise<DisputeView | "NOT_OPEN">;
  list(
    tenantId: string,
    profileId: string,
    resolver: boolean,
  ): Promise<DisputeView[]>;
  audit(input: {
    tenantId: string;
    actorId: string;
    action: string;
    targetId: string;
    requestId: string;
  }): Promise<void>;
}
