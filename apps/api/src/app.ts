import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { createAuthRoutes } from "./modules/auth/routes.js";
import type { AuthService } from "./modules/auth/service.js";

export function createApp(
  options: {
    authService?: AuthService;
    graphqlFetch?: (request: Request) => Response | Promise<Response>;
  } = {},
) {
  const app = new Hono();
  app.use("*", requestId());
  app.use(
    "*",
    cors({
      origin: process.env.WEB_URL ?? "http://localhost:3000",
      credentials: true,
    }),
  );
  app.use("*", async (context, next) => {
    const startedAt = performance.now();
    await next();
    console.info(
      JSON.stringify({
        level: "info",
        event: "http.request_completed",
        requestId: context.get("requestId"),
        method: context.req.method,
        route:
          context.req.path === "/graphql"
            ? "/graphql"
            : context.req.path.startsWith("/v1/auth/")
              ? "/v1/auth/*"
              : context.req.path,
        status: context.res.status,
        durationMs: Math.round(performance.now() - startedAt),
      }),
    );
  });
  app.get("/health", (context) =>
    context.json({
      status: "ok",
      service: "freelance-marketplace-api",
      cluster: process.env.SOLANA_CLUSTER ?? "unknown",
    }),
  );
  if (options.authService)
    app.route("/v1/auth", createAuthRoutes(options.authService));
  const graphQLFetch = options.graphqlFetch;
  if (graphQLFetch)
    app.on(["GET", "POST"], "/graphql", (context) =>
      graphQLFetch(context.req.raw),
    );
  app.notFound((context) =>
    context.json(
      { error: { code: "NOT_FOUND", message: "Route not found" } },
      404,
    ),
  );
  return app;
}
