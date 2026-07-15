import { GraphQLError } from "graphql";
import { createSchema, createYoga } from "graphql-yoga";
import type { AuthService } from "../auth/service.js";
import { AuthError } from "../auth/service.js";
import { JobError, type JobService } from "./service.js";

const cookie = (request: Request) =>
  request.headers
    .get("cookie")
    ?.match(/(?:^|; )marketplace_session=([^;]+)/)?.[1];
const failure = (error: unknown) => {
  if (error instanceof AuthError || error instanceof JobError)
    throw new GraphQLError(error.code, { extensions: { code: error.code } });
  throw error;
};

export function createMarketplaceGraphQL(auth: AuthService, jobs: JobService) {
  return createYoga({
    graphqlEndpoint: "/graphql",
    schema: createSchema({
      typeDefs: /* GraphQL */ `
        type Job { id: ID!, clientName: String!, title: String!, description: String!, category: String!, skills: [String!]!, budgetMinor: String!, currency: String!, status: String!, createdAt: String! }
        type JobConnection { jobs: [Job!]!, nextCursor: String }
        type SavedSearch { id: ID!, name: String!, search: String, category: String, minBudgetMinor: String, maxBudgetMinor: String, createdAt: String! }
        input JobFilter { search: String, category: String, minBudgetMinor: String, maxBudgetMinor: String, cursor: String, limit: Int = 20 }
        input SaveSearchInput { name: String!, search: String, category: String, minBudgetMinor: String, maxBudgetMinor: String }
        input CreateJobInput { title: String!, description: String!, category: String!, skills: [String!]!, budgetMinor: String!, currency: String!, publish: Boolean = true }
        type Query { jobs(tenantSlug: String!, filter: JobFilter): JobConnection!, savedSearches: [SavedSearch!]! }
        type Mutation { createJob(input: CreateJobInput!): Job!, saveSearch(input: SaveSearchInput!): SavedSearch! }
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
        },
      },
    }),
  });
}
