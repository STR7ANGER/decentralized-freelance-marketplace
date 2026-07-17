import type { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import type {
  ContractView,
  MessageView,
  MilestoneDraft,
  ProposalRepository,
  ProposalView,
} from "./ports.js";

const proposalSelect = {
  id: true,
  jobId: true,
  freelancerId: true,
  coverLetter: true,
  totalAmountMinor: true,
  currency: true,
  deliveryDays: true,
  status: true,
  version: true,
  termsHash: true,
  milestoneDraft: true,
  createdAt: true,
  freelancer: { select: { displayName: true } },
} as const;
type ProposalRow = Prisma.ProposalGetPayload<{ select: typeof proposalSelect }>;
const milestones = (value: Prisma.JsonValue): MilestoneDraft[] =>
  (value as Array<{ title: string; amountMinor: string; dueAt: string }>).map(
    (item) => ({
      title: item.title,
      amountMinor: BigInt(item.amountMinor),
      dueAt: new Date(item.dueAt),
    }),
  );
const milestoneJson = (items: MilestoneDraft[]) =>
  items.map((item) => ({
    title: item.title,
    amountMinor: item.amountMinor.toString(),
    dueAt: item.dueAt.toISOString(),
  }));
const proposalView = (row: ProposalRow): ProposalView => ({
  id: row.id,
  jobId: row.jobId,
  freelancerId: row.freelancerId,
  freelancerName: row.freelancer.displayName,
  coverLetter: row.coverLetter,
  totalAmountMinor: row.totalAmountMinor,
  currency: row.currency,
  deliveryDays: row.deliveryDays,
  status: row.status,
  version: row.version,
  termsHash: row.termsHash,
  milestones: milestones(row.milestoneDraft),
  createdAt: row.createdAt,
});
const contractView = (row: {
  id: string;
  proposalId: string;
  status: string;
  version: number;
  termsHash: string;
  clientAgreedAt: Date | null;
  freelancerAgreedAt: Date | null;
}): ContractView => row;
const messageSelect = {
  id: true,
  jobId: true,
  proposalId: true,
  authorId: true,
  body: true,
  createdAt: true,
  author: { select: { displayName: true } },
} as const;
type MessageRow = Prisma.JobMessageGetPayload<{ select: typeof messageSelect }>;
const messageView = (row: MessageRow): MessageView => ({
  id: row.id,
  jobId: row.jobId,
  proposalId: row.proposalId,
  authorId: row.authorId,
  authorName: row.author.displayName,
  body: row.body,
  createdAt: row.createdAt,
});

export class PrismaProposalRepository implements ProposalRepository {
  jobForProposal(tenantId: string, jobId: string) {
    return prisma.job.findFirst({
      where: { id: jobId, tenantId },
      select: { id: true, clientId: true, status: true, currency: true },
    });
  }
  async proposalForFreelancer(
    tenantId: string,
    jobId: string,
    freelancerId: string,
  ) {
    const row = await prisma.proposal.findFirst({
      where: { tenantId, jobId, freelancerId },
      select: proposalSelect,
    });
    return row ? proposalView(row) : null;
  }
  async createProposal(input: {
    tenantId: string;
    jobId: string;
    freelancerId: string;
    coverLetter: string;
    totalAmountMinor: bigint;
    currency: string;
    deliveryDays: number;
    termsHash: string;
    milestones: MilestoneDraft[];
  }) {
    return prisma.$transaction(async (tx) => {
      const data = {
        tenantId: input.tenantId,
        jobId: input.jobId,
        freelancerId: input.freelancerId,
        coverLetter: input.coverLetter,
        totalAmountMinor: input.totalAmountMinor,
        currency: input.currency,
        deliveryDays: input.deliveryDays,
        termsHash: input.termsHash,
        milestoneDraft: milestoneJson(input.milestones),
      };
      const row = await tx.proposal.create({ data, select: proposalSelect });
      await tx.proposalRevision.create({
        data: {
          proposalId: row.id,
          version: 1,
          coverLetter: input.coverLetter,
          totalAmountMinor: input.totalAmountMinor,
          currency: input.currency,
          deliveryDays: input.deliveryDays,
          termsHash: input.termsHash,
          milestoneDraft: milestoneJson(input.milestones),
        },
      });
      return proposalView(row);
    });
  }
  async reviseProposal(input: {
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
  }) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.proposal.updateMany({
        where: {
          id: input.proposalId,
          tenantId: input.tenantId,
          freelancerId: input.freelancerId,
          version: input.expectedVersion,
          status: { in: ["SUBMITTED", "SHORTLISTED"] },
        },
        data: {
          coverLetter: input.coverLetter,
          totalAmountMinor: input.totalAmountMinor,
          currency: input.currency,
          deliveryDays: input.deliveryDays,
          termsHash: input.termsHash,
          milestoneDraft: milestoneJson(input.milestones),
          version: { increment: 1 },
          status: "SUBMITTED",
        },
      });
      if (updated.count !== 1) return null;
      const version = input.expectedVersion + 1;
      await tx.proposalRevision.create({
        data: {
          proposalId: input.proposalId,
          version,
          coverLetter: input.coverLetter,
          totalAmountMinor: input.totalAmountMinor,
          currency: input.currency,
          deliveryDays: input.deliveryDays,
          termsHash: input.termsHash,
          milestoneDraft: milestoneJson(input.milestones),
        },
      });
      const row = await tx.proposal.findUniqueOrThrow({
        where: { id: input.proposalId },
        select: proposalSelect,
      });
      return proposalView(row);
    });
  }
  async proposalsForClient(tenantId: string, jobId: string, clientId: string) {
    const job = await prisma.job.findFirst({
      where: { id: jobId, tenantId, clientId },
      select: { id: true },
    });
    if (!job) return null;
    const rows = await prisma.proposal.findMany({
      where: { tenantId, jobId, status: { not: "WITHDRAWN" } },
      orderBy: [{ totalAmountMinor: "asc" }, { createdAt: "asc" }],
      select: proposalSelect,
    });
    return rows.map(proposalView);
  }
  acceptProposal(input: {
    tenantId: string;
    clientId: string;
    proposalId: string;
    expectedVersion: number;
  }) {
    return prisma.$transaction(async (tx) => {
      const proposal = await tx.proposal.findFirst({
        where: { id: input.proposalId, tenantId: input.tenantId },
        include: {
          job: { select: { clientId: true, status: true } },
          contract: true,
        },
      });
      if (!proposal || proposal.job.clientId !== input.clientId)
        return "NOT_FOUND" as const;
      if (
        proposal.version !== input.expectedVersion ||
        !["SUBMITTED", "SHORTLISTED", "ACCEPTED"].includes(proposal.status)
      )
        return "VERSION_CONFLICT" as const;
      if (proposal.contract) return contractView(proposal.contract);
      const updated = await tx.proposal.updateMany({
        where: {
          id: proposal.id,
          version: input.expectedVersion,
          status: { in: ["SUBMITTED", "SHORTLISTED"] },
        },
        data: { status: "ACCEPTED" },
      });
      if (updated.count !== 1) return "VERSION_CONFLICT" as const;
      await tx.proposal.updateMany({
        where: {
          jobId: proposal.jobId,
          id: { not: proposal.id },
          status: { in: ["SUBMITTED", "SHORTLISTED"] },
        },
        data: { status: "REJECTED" },
      });
      await tx.job.update({
        where: { id: proposal.jobId },
        data: { status: "PAUSED" },
      });
      const draft = milestones(proposal.milestoneDraft);
      const contract = await tx.contract.create({
        data: {
          tenantId: input.tenantId,
          proposalId: proposal.id,
          termsHash: proposal.termsHash,
          milestones: {
            create: draft.map((item, position) => ({
              position,
              title: item.title,
              amountMinor: item.amountMinor,
              dueAt: item.dueAt,
              status: "AGREED",
            })),
          },
        },
      });
      return contractView(contract);
    });
  }
  async contractParticipant(
    tenantId: string,
    contractId: string,
    actorId: string,
  ) {
    const row = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      include: {
        proposal: { include: { job: { select: { clientId: true } } } },
      },
    });
    if (!row) return null;
    const side =
      row.proposal.job.clientId === actorId
        ? ("CLIENT" as const)
        : row.proposal.freelancerId === actorId
          ? ("FREELANCER" as const)
          : null;
    return side ? { contract: contractView(row), side } : null;
  }
  agreeContract(input: {
    tenantId: string;
    contractId: string;
    actorId: string;
    side: "CLIENT" | "FREELANCER";
    agreedAt: Date;
  }) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.contract.update({
        where: { id: input.contractId, tenantId: input.tenantId },
        data:
          input.side === "CLIENT"
            ? { clientAgreedAt: input.agreedAt }
            : { freelancerAgreedAt: input.agreedAt },
      });
      if (
        current.clientAgreedAt &&
        current.freelancerAgreedAt &&
        current.status === "NEGOTIATING"
      )
        return contractView(
          await tx.contract.update({
            where: { id: current.id },
            data: { status: "AGREED", version: { increment: 1 } },
          }),
        );
      return contractView(current);
    });
  }
  async canMessage(
    tenantId: string,
    jobId: string,
    proposalId: string | undefined,
    actorId: string,
  ) {
    const job = await prisma.job.findFirst({
      where: { id: jobId, tenantId },
      select: { clientId: true },
    });
    if (!job) return false;
    if (!proposalId) return job.clientId === actorId;
    const proposal = await prisma.proposal.findFirst({
      where: { id: proposalId, jobId, tenantId },
      select: { freelancerId: true },
    });
    return Boolean(
      proposal &&
        (job.clientId === actorId || proposal.freelancerId === actorId),
    );
  }
  async createMessage(input: {
    tenantId: string;
    jobId: string;
    proposalId?: string;
    authorId: string;
    body: string;
  }) {
    const row = await prisma.jobMessage.create({
      data: {
        tenantId: input.tenantId,
        jobId: input.jobId,
        authorId: input.authorId,
        body: input.body,
        ...(input.proposalId ? { proposalId: input.proposalId } : {}),
      },
      select: messageSelect,
    });
    return messageView(row);
  }
  async messages(input: {
    tenantId: string;
    jobId: string;
    proposalId?: string;
    actorId: string;
    limit: number;
  }) {
    if (
      !(await this.canMessage(
        input.tenantId,
        input.jobId,
        input.proposalId,
        input.actorId,
      ))
    )
      return null;
    const rows = await prisma.jobMessage.findMany({
      where: {
        tenantId: input.tenantId,
        jobId: input.jobId,
        ...(input.proposalId
          ? { proposalId: input.proposalId }
          : { proposalId: null }),
      },
      orderBy: { createdAt: "asc" },
      take: input.limit,
      select: messageSelect,
    });
    return rows.map(messageView);
  }
  async audit(input: {
    tenantId: string;
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    requestId: string;
  }) {
    await prisma.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        actorId: input.actorId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        requestId: input.requestId,
      },
    });
  }
}
