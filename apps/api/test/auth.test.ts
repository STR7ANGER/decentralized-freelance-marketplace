import bs58 from "bs58";
import nacl from "tweetnacl";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type {
  AuthProfile,
  AuthRepository,
  StoredChallenge,
} from "../src/modules/auth/repository.js";
import { AuthService } from "../src/modules/auth/service.js";

class MemoryAuthRepository implements AuthRepository {
  challenge?: StoredChallenge;
  profile?: AuthProfile;
  tokenHash: string | undefined;
  consumed = false;
  audits: string[] = [];
  async findTenant(slug: string) {
    return slug === "demo" ? { id: "tenant-1", slug } : null;
  }
  async createChallenge(input: Omit<StoredChallenge, "consumedAt">) {
    this.challenge = { ...input, consumedAt: null };
  }
  async findChallenge(id: string) {
    return this.challenge?.id === id ? this.challenge : null;
  }
  async consumeChallenge(id: string, now: Date) {
    if (
      !this.challenge ||
      this.challenge.id !== id ||
      this.consumed ||
      this.challenge.expiresAt <= now
    )
      return false;
    this.consumed = true;
    this.challenge.consumedAt = now;
    return true;
  }
  async findProfileByWallet() {
    return this.profile ?? null;
  }
  async createProfileWithWallet(input: {
    tenantId: string;
    address: string;
    displayName: string;
    role: "CLIENT" | "FREELANCER";
  }) {
    this.profile = {
      id: "profile-1",
      tenantId: input.tenantId,
      displayName: input.displayName,
      role: input.role,
      walletAddress: input.address,
    };
    return this.profile;
  }
  async createSession(input: { tokenHash: string }) {
    this.tokenHash = input.tokenHash;
  }
  async findProfileBySession(tokenHash: string) {
    return tokenHash === this.tokenHash ? (this.profile ?? null) : null;
  }
  async revokeSession() {
    this.tokenHash = undefined;
  }
  async audit(input: { action: string }) {
    this.audits.push(input.action);
  }
}

const now = new Date("2026-07-16T00:00:00.000Z");
const config = {
  domain: "localhost",
  apiUrl: "http://localhost:3001",
  cluster: "localnet" as const,
  nonceTtlSeconds: 300,
  sessionSecret: "test-session-secret-at-least-32-characters",
};

describe("wallet authentication", () => {
  it("verifies an Ed25519 signature, consumes its nonce, and creates a session", async () => {
    const keys = nacl.sign.keyPair();
    const walletAddress = bs58.encode(keys.publicKey);
    const repository = new MemoryAuthRepository();
    const service = new AuthService(repository, config, () => now);
    const challenge = await service.challenge({
      walletAddress,
      tenantSlug: "demo",
    });
    expect(challenge.message).toContain(
      "does not submit a transaction or move funds",
    );
    const result = await service.verify({
      challengeId: challenge.challengeId,
      walletAddress,
      message: challenge.message,
      signature: bs58.encode(
        nacl.sign.detached(
          new TextEncoder().encode(challenge.message),
          keys.secretKey,
        ),
      ),
      displayName: "Freelancer",
      role: "FREELANCER",
      requestId: "request-1",
    });
    await expect(service.authenticate(result.token)).resolves.toMatchObject({
      walletAddress,
      role: "FREELANCER",
    });
    expect(repository.challenge?.nonceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(repository.tokenHash).not.toBe(result.token);
    expect(repository.audits).toEqual(["auth.wallet_verified"]);
    await expect(
      service.verify({
        challengeId: challenge.challengeId,
        walletAddress,
        message: challenge.message,
        signature: bs58.encode(
          nacl.sign.detached(
            new TextEncoder().encode(challenge.message),
            keys.secretKey,
          ),
        ),
        displayName: "Freelancer",
        role: "FREELANCER",
        requestId: "request-2",
      }),
    ).rejects.toMatchObject({ code: "INVALID_CHALLENGE" });
    await service.logout(result.token);
    await expect(service.authenticate(result.token)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("rejects malformed addresses, altered messages, and bad signatures", async () => {
    const repository = new MemoryAuthRepository();
    const service = new AuthService(repository, config, () => now);
    await expect(
      service.challenge({ walletAddress: "not-a-wallet", tenantSlug: "demo" }),
    ).rejects.toMatchObject({ code: "INVALID_WALLET" });
    const keys = nacl.sign.keyPair();
    const walletAddress = bs58.encode(keys.publicKey);
    const challenge = await service.challenge({
      walletAddress,
      tenantSlug: "demo",
    });
    await expect(
      service.verify({
        challengeId: challenge.challengeId,
        walletAddress,
        message: `${challenge.message}!`,
        signature: bs58.encode(new Uint8Array(64)),
        displayName: "Client",
        role: "CLIENT",
        requestId: "request",
      }),
    ).rejects.toMatchObject({ code: "INVALID_CHALLENGE" });
    await expect(
      service.verify({
        challengeId: challenge.challengeId,
        walletAddress,
        message: challenge.message,
        signature: bs58.encode(new Uint8Array(64)),
        displayName: "Client",
        role: "CLIENT",
        requestId: "request",
      }),
    ).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });
  });

  it("rejects a correctly signed challenge after its expiry", async () => {
    const keys = nacl.sign.keyPair();
    const walletAddress = bs58.encode(keys.publicKey);
    const repository = new MemoryAuthRepository();
    let clock = now;
    const service = new AuthService(repository, config, () => clock);
    const challenge = await service.challenge({
      walletAddress,
      tenantSlug: "demo",
    });
    clock = new Date(now.valueOf() + 301_000);
    await expect(
      service.verify({
        challengeId: challenge.challengeId,
        walletAddress,
        message: challenge.message,
        signature: bs58.encode(
          nacl.sign.detached(
            new TextEncoder().encode(challenge.message),
            keys.secretKey,
          ),
        ),
        displayName: "Client",
        role: "CLIENT",
        requestId: "request",
      }),
    ).rejects.toMatchObject({ code: "INVALID_CHALLENGE" });
  });

  it("completes the HTTP wallet flow and rejects nonce replay", async () => {
    const keys = nacl.sign.keyPair();
    const walletAddress = bs58.encode(keys.publicKey);
    const service = new AuthService(
      new MemoryAuthRepository(),
      config,
      () => now,
    );
    const app = createApp({ authService: service });
    const challengeResponse = await app.request("/v1/auth/challenge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ walletAddress, tenantSlug: "demo" }),
    });
    expect(challengeResponse.status).toBe(201);
    const challenge = (await challengeResponse.json()) as {
      challengeId: string;
      message: string;
    };
    const payload = {
      challengeId: challenge.challengeId,
      walletAddress,
      message: challenge.message,
      signature: bs58.encode(
        nacl.sign.detached(
          new TextEncoder().encode(challenge.message),
          keys.secretKey,
        ),
      ),
      displayName: "HTTP Freelancer",
      role: "FREELANCER",
    };
    const verified = await app.request("/v1/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(verified.status).toBe(200);
    const cookie = verified.headers.get("set-cookie")?.split(";")[0];
    expect(cookie).toContain("marketplace_session=");
    const me = await app.request("/v1/auth/me", {
      headers: { cookie: cookie ?? "" },
    });
    expect(me.status).toBe(200);
    await expect(me.json()).resolves.toMatchObject({
      profile: { walletAddress, role: "FREELANCER" },
    });
    const replay = await app.request("/v1/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(replay.status).toBe(400);
  });
});
