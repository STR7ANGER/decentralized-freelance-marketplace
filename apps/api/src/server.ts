import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { parseEnvironment } from "./env.js";
import { PrismaAuthRepository } from "./modules/auth/prisma-repository.js";
import { AuthService } from "./modules/auth/service.js";
import { createMarketplaceGraphQL } from "./modules/jobs/graphql.js";
import { PrismaJobRepository } from "./modules/jobs/prisma-repository.js";
import { JobService } from "./modules/jobs/service.js";

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
const graphQL = createMarketplaceGraphQL(auth, jobs);
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
