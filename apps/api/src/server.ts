import { serve } from "@hono/node-server";
import {
  PrismaChainEventRepository,
  TransactionHistoryService,
} from "@marketplace/indexer";
import { createApp } from "./app.js";
import { parseEnvironment } from "./env.js";
import { PrismaAuthRepository } from "./modules/auth/prisma-repository.js";
import { AuthService } from "./modules/auth/service.js";
import { PrismaDisputeRepository } from "./modules/disputes/prisma-repository.js";
import { DisputeService } from "./modules/disputes/service.js";
import { createMarketplaceGraphQL } from "./modules/jobs/graphql.js";
import { PrismaJobRepository } from "./modules/jobs/prisma-repository.js";
import { JobService } from "./modules/jobs/service.js";
import { PrismaProposalRepository } from "./modules/proposals/prisma-repository.js";
import { ProposalService } from "./modules/proposals/service.js";
import { PrismaReputationRepository } from "./modules/reputation/prisma-repository.js";
import { ReputationService } from "./modules/reputation/service.js";

const environment = parseEnvironment(process.env);
const auth = new AuthService(new PrismaAuthRepository(), {
  domain: environment.AUTH_DOMAIN,
  apiUrl: environment.API_URL,
  cluster: environment.SOLANA_CLUSTER,
  nonceTtlSeconds: environment.AUTH_NONCE_TTL_SECONDS,
  sessionSecret: environment.SESSION_SECRET,
});
const jobs = new JobService(new PrismaJobRepository(), {
  record: (event) => console.info(JSON.stringify({ level: "info", ...event })),
});
const proposals = new ProposalService(new PrismaProposalRepository(), {
  record: (event) => console.info(JSON.stringify({ level: "info", ...event })),
});
const disputes = new DisputeService(new PrismaDisputeRepository(), {
  record: (event) => console.info(JSON.stringify({ level: "info", ...event })),
});
const reputation = new ReputationService(new PrismaReputationRepository(), {
  record: (event) => console.info(JSON.stringify({ level: "info", ...event })),
});
const history = new TransactionHistoryService(new PrismaChainEventRepository());
const graphQL = createMarketplaceGraphQL(
  auth,
  jobs,
  proposals,
  history,
  disputes,
  reputation,
);
serve({
  fetch: createApp({
    authService: auth,
    graphqlFetch: (request) => graphQL.fetch(request),
  }).fetch,
  port: environment.PORT,
});
console.info(
  JSON.stringify({
    level: "info",
    event: "server.started",
    port: environment.PORT,
    cluster: environment.SOLANA_CLUSTER,
  }),
);
