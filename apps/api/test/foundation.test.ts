import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { parseEnvironment } from "../src/env.js";

const environment = {
  NODE_ENV: "test",
  WEB_URL: "http://localhost:3000",
  API_URL: "http://localhost:3001",
  PORT: "3001",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  MONGODB_URI: "mongodb://localhost:27017/db",
  REDIS_URL: "redis://localhost:6379",
  S3_ENDPOINT: "http://localhost:9000",
  S3_REGION: "us-east-1",
  S3_BUCKET: "bucket",
  S3_ACCESS_KEY: "access",
  S3_SECRET_KEY: "secret-value",
  SESSION_SECRET: "session-secret-with-at-least-32-characters",
  SOLANA_CLUSTER: "localnet",
  SOLANA_RPC_URL: "http://127.0.0.1:8899",
  AUTH_DOMAIN: "localhost",
  AUTH_NONCE_TTL_SECONDS: "300",
};
describe("foundation", () => {
  it("validates startup configuration and rejects unsafe clusters", () => {
    expect(parseEnvironment(environment)).toMatchObject({
      PORT: 3001,
      SOLANA_CLUSTER: "localnet",
    });
    expect(() =>
      parseEnvironment({ ...environment, SOLANA_CLUSTER: "mainnet-beta" }),
    ).toThrow();
    expect(() =>
      parseEnvironment({ ...environment, SESSION_SECRET: "short" }),
    ).toThrow();
  });
  it("exposes only bounded health information", async () => {
    const response = await createApp().request("/health");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      status: "ok",
      service: "freelance-marketplace-api",
    });
    expect(JSON.stringify(body)).not.toContain("postgresql");
  });
});
