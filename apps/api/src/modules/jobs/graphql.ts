import type { TransactionHistoryService } from "@marketplace/indexer";
import { GraphQLError } from "graphql";
import { createSchema, createYoga } from "graphql-yoga";
import type { AuthService } from "../auth/service.js";
import { AuthError } from "../auth/service.js";
import { DisputeError, type DisputeService } from "../disputes/service.js";
import { ProposalError, type ProposalService } from "../proposals/service.js";
import { JobError, type JobService } from "./service.js";

const cookie = (request: Request) =>
  request.headers
    .get("cookie")
    ?.match(/(?:^|; )marketplace_session=([^;]+)/)?.[1];
const failure = (error: unknown) => {
  if (
    error instanceof AuthError ||
    error instanceof DisputeError ||
    error instanceof JobError ||
    error instanceof ProposalError
  )
    throw new GraphQLError(error.code, { extensions: { code: error.code } });
  throw error;
};

export function createMarketplaceGraphQL(
  auth: AuthService,
  jobs: JobService,
  proposals: ProposalService,
  history: TransactionHistoryService,
  disputes: DisputeService,
) {
  return createYoga({
    graphqlEndpoint: "/graphql",
    schema: createSchema({
      typeDefs: /* GraphQL */ `
        type Job { id: ID!, clientName: String!, title: String!, description: String!, category: String!, skills: [String!]!, budgetMinor: String!, currency: String!, status: String!, createdAt: String! }
        type JobConnection { jobs: [Job!]!, nextCursor: String }
        type SavedSearch { id: ID!, name: String!, search: String, category: String, minBudgetMinor: String, maxBudgetMinor: String, createdAt: String! }
        type MilestoneDraft { title: String!, amountMinor: String!, dueAt: String! }
        type Proposal { id: ID!, jobId: ID!, freelancerId: ID!, freelancerName: String!, coverLetter: String!, totalAmountMinor: String!, currency: String!, deliveryDays: Int!, status: String!, version: Int!, termsHash: String!, milestones: [MilestoneDraft!]!, createdAt: String! }
        type Contract { id: ID!, proposalId: ID!, status: String!, version: Int!, termsHash: String!, clientAgreedAt: String, freelancerAgreedAt: String }
        type Message { id: ID!, jobId: ID!, proposalId: ID, authorId: ID!, authorName: String!, body: String!, createdAt: String! }
        type ChainEvent { id: ID!, signature: String!, eventIndex: Int!, programId: String!, slot: String!, confirmation: String!, eventType: String!, blockTime: String, observedAt: String!, updatedAt: String! }
        type Dispute { id: ID!, contractId: ID!, openedById: ID!, evidenceCid: String!, evidenceHash: String!, status: String!, resolverId: ID, clientAmountMinor: String, freelancerAmountMinor: String, resolutionHash: String, createdAt: String!, resolvedAt: String }
        input JobFilter { search: String, category: String, minBudgetMinor: String, maxBudgetMinor: String, cursor: String, limit: Int = 20 }
        input SaveSearchInput { name: String!, search: String, category: String, minBudgetMinor: String, maxBudgetMinor: String }
        input CreateJobInput { title: String!, description: String!, category: String!, skills: [String!]!, budgetMinor: String!, currency: String!, publish: Boolean = true }
        input MilestoneDraftInput { title: String!, amountMinor: String!, dueAt: String! }
        input ProposalInput { jobId: ID!, coverLetter: String!, totalAmountMinor: String!, currency: String!, deliveryDays: Int!, milestones: [MilestoneDraftInput!]!, expectedVersion: Int }
        input AcceptProposalInput { proposalId: ID!, expectedVersion: Int! }
        input AgreeContractInput { contractId: ID!, termsHash: String!, signature: String! }
        input MessageInput { jobId: ID!, proposalId: ID, body: String! }
        input OpenDisputeInput { contractId: ID!, evidenceCid: String!, evidenceHash: String!, privateNote: String }
        input ResolveDisputeInput { disputeId: ID!, clientAmountMinor: String!, freelancerAmountMinor: String!, resolutionHash: String! }
        type Query { jobs(tenantSlug: String!, filter: JobFilter): JobConnection!, savedSearches: [SavedSearch!]!, proposals(jobId: ID!): [Proposal!]!, messages(jobId: ID!, proposalId: ID, limit: Int): [Message!]!, transactionHistory(limit: Int): [ChainEvent!]!, disputes: [Dispute!]! }
        type Mutation { createJob(input: CreateJobInput!): Job!, saveSearch(input: SaveSearchInput!): SavedSearch!, submitProposal(input: ProposalInput!): Proposal!, acceptProposal(input: AcceptProposalInput!): Contract!, agreeContract(input: AgreeContractInput!): Contract!, sendMessage(input: MessageInput!): Message!, openDispute(input: OpenDisputeInput!): Dispute!, resolveDispute(input: ResolveDisputeInput!): Dispute! }
      `,
      resolvers: {
        Query: {
          jobs: async (
            _root,
            input: { tenantSlug: string; filter?: unknown },
          ) => {
            try {
              return await jobs.search(input.tenantSlug, input.filter ?? {});
            } catch (error) {
              return failure(error);
            }
          },
          savedSearches: async (
            _root,
            _input,
            context: { request: Request },
          ) => {
            try {
              const profile = await auth.authenticate(cookie(context.request));
              return await jobs.savedSearches(profile);
            } catch (error) {
              return failure(error);
            }
          },
          proposals: async (
            _root,
            input: { jobId: string },
            context: { request: Request },
          ) => {
            try {
              return await proposals.compare(
                await auth.authenticate(cookie(context.request)),
                input.jobId,
              );
            } catch (error) {
              return failure(error);
            }
          },
          messages: async (
            _root,
            input: { jobId: string; proposalId?: string; limit?: number },
            context: { request: Request },
          ) => {
            try {
              return await proposals.messages(
                await auth.authenticate(cookie(context.request)),
                input,
              );
            } catch (error) {
              return failure(error);
            }
          },
          transactionHistory: async (
            _root,
            input: { limit?: number },
            context: { request: Request },
          ) => {
            try {
              const profile = await auth.authenticate(cookie(context.request));
              const events = await history.history(
                profile.walletAddress,
                input.limit,
              );
              return events.map((event) => ({
                ...event,
                slot: event.slot.toString(),
                blockTime: event.blockTime?.toISOString() ?? null,
                observedAt: event.observedAt.toISOString(),
                updatedAt: event.updatedAt.toISOString(),
              }));
            } catch (error) {
              return failure(error);
            }
          },
          disputes: async (_root, _input, context: { request: Request }) => {
            try {
              return await disputes.list(
                await auth.authenticate(cookie(context.request)),
              );
            } catch (error) {
              return failure(error);
            }
          },
        },
        Mutation: {
          createJob: async (
            _root,
            input: { input: unknown },
            context: { request: Request },
          ) => {
            try {
              const profile = await auth.authenticate(cookie(context.request));
              return await jobs.create(
                profile,
                input.input,
                context.request.headers.get("x-request-id") ??
                  crypto.randomUUID(),
              );
            } catch (error) {
              return failure(error);
            }
          },
          saveSearch: async (
            _root,
            input: { input: unknown },
            context: { request: Request },
          ) => {
            try {
              const profile = await auth.authenticate(cookie(context.request));
              return await jobs.saveSearch(profile, input.input);
            } catch (error) {
              return failure(error);
            }
          },
          submitProposal: async (
            _root,
            input: { input: unknown },
            context: { request: Request },
          ) => {
            try {
              return await proposals.submit(
                await auth.authenticate(cookie(context.request)),
                input.input,
                context.request.headers.get("x-request-id") ??
                  crypto.randomUUID(),
              );
            } catch (error) {
              return failure(error);
            }
          },
          acceptProposal: async (
            _root,
            input: { input: unknown },
            context: { request: Request },
          ) => {
            try {
              return await proposals.accept(
                await auth.authenticate(cookie(context.request)),
                input.input,
                context.request.headers.get("x-request-id") ??
                  crypto.randomUUID(),
              );
            } catch (error) {
              return failure(error);
            }
          },
          agreeContract: async (
            _root,
            input: { input: unknown },
            context: { request: Request },
          ) => {
            try {
              return await proposals.agree(
                await auth.authenticate(cookie(context.request)),
                input.input,
                context.request.headers.get("x-request-id") ??
                  crypto.randomUUID(),
              );
            } catch (error) {
              return failure(error);
            }
          },
          sendMessage: async (
            _root,
            input: { input: unknown },
            context: { request: Request },
          ) => {
            try {
              return await proposals.sendMessage(
                await auth.authenticate(cookie(context.request)),
                input.input,
              );
            } catch (error) {
              return failure(error);
            }
          },
          openDispute: async (
            _root,
            input: { input: unknown },
            context: { request: Request },
          ) => {
            try {
              return await disputes.open(
                await auth.authenticate(cookie(context.request)),
                input.input,
                context.request.headers.get("x-request-id") ??
                  crypto.randomUUID(),
              );
            } catch (error) {
              return failure(error);
            }
          },
          resolveDispute: async (
            _root,
            input: { input: unknown },
            context: { request: Request },
          ) => {
            try {
              return await disputes.resolve(
                await auth.authenticate(cookie(context.request)),
                input.input,
                context.request.headers.get("x-request-id") ??
                  crypto.randomUUID(),
              );
            } catch (error) {
              return failure(error);
            }
          },
        },
      },
    }),
  });
}
