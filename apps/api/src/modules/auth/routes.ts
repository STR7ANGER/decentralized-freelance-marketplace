import {
  challengeRequestSchema,
  verifyWalletSchema,
} from "@marketplace/contracts";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { AuthError, type AuthService } from "./service.js";

export function createAuthRoutes(service: AuthService) {
  const routes = new Hono();
  routes.onError((error, context) => {
    if (error instanceof AuthError)
      return context.json(
        {
          error: { code: error.code, message: "Wallet authentication failed" },
        },
        error.code === "TENANT_NOT_FOUND"
          ? 404
          : error.code === "UNAUTHENTICATED"
            ? 401
            : 400,
      );
    if (error instanceof z.ZodError)
      return context.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid request" } },
        400,
      );
    throw error;
  });
  routes.post("/challenge", async (context) =>
    context.json(
      await service.challenge(
        challengeRequestSchema.parse(await context.req.json()),
      ),
      201,
    ),
  );
  routes.post("/verify", async (context) => {
    const result = await service.verify({
      ...verifyWalletSchema.parse(await context.req.json()),
      requestId: context.get("requestId"),
    });
    setCookie(context, "marketplace_session", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      path: "/",
      expires: result.expiresAt,
    });
    return context.json({ profile: result.profile });
  });
  routes.get("/me", async (context) =>
    context.json({
      profile: await service.authenticate(
        getCookie(context, "marketplace_session"),
      ),
    }),
  );
  routes.post("/logout", async (context) => {
    await service.logout(getCookie(context, "marketplace_session"));
    deleteCookie(context, "marketplace_session", { path: "/" });
    return context.body(null, 204);
  });
  return routes;
}
