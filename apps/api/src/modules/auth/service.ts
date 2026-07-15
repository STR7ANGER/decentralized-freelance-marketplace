import { createHash, randomBytes, randomUUID } from "node:crypto";
import { address } from "@solana/kit";
import bs58 from "bs58";
import nacl from "tweetnacl";
import type { AuthProfile, AuthRepository } from "./repository.js";

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const sessionHash = (value: string, secret: string) =>
  createHash("sha256").update(`${secret}:${value}`).digest("hex");
const canonicalMessage = (input: {
  domain: string;
  apiUrl: string;
  walletAddress: string;
  cluster: string;
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
}) =>
  `${input.domain} wants you to sign in with your Solana account:\n${input.walletAddress}\n\nSign in to the freelance marketplace. This request does not submit a transaction or move funds.\n\nURI: ${input.apiUrl}\nVersion: 1\nChain ID: solana:${input.cluster}\nNonce: ${input.nonce}\nIssued At: ${input.issuedAt.toISOString()}\nExpiration Time: ${input.expiresAt.toISOString()}`;

export class AuthError extends Error {
  constructor(
    readonly code:
      | "INVALID_WALLET"
      | "TENANT_NOT_FOUND"
      | "INVALID_CHALLENGE"
      | "INVALID_SIGNATURE"
      | "UNAUTHENTICATED",
  ) {
    super(code);
  }
}

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly config: {
      domain: string;
      apiUrl: string;
      cluster: "localnet" | "devnet";
      nonceTtlSeconds: number;
      sessionSecret: string;
    },
    private readonly now = () => new Date(),
  ) {}

  async challenge(input: { walletAddress: string; tenantSlug: string }) {
    try {
      address(input.walletAddress);
    } catch {
      throw new AuthError("INVALID_WALLET");
    }
    const tenant = await this.repository.findTenant(input.tenantSlug);
    if (!tenant) throw new AuthError("TENANT_NOT_FOUND");
    const issuedAt = this.now();
    const expiresAt = new Date(
      issuedAt.valueOf() + this.config.nonceTtlSeconds * 1000,
    );
    const nonce = randomBytes(18).toString("base64url");
    const message = canonicalMessage({
      domain: this.config.domain,
      apiUrl: this.config.apiUrl,
      walletAddress: input.walletAddress,
      cluster: this.config.cluster,
      nonce,
      issuedAt,
      expiresAt,
    });
    const id = randomUUID();
    await this.repository.createChallenge({
      id,
      tenantId: tenant.id,
      address: input.walletAddress,
      nonceHash: sha256(nonce),
      messageHash: sha256(message),
      expiresAt,
    });
    return { challengeId: id, message, expiresAt };
  }

  async verify(input: {
    challengeId: string;
    walletAddress: string;
    message: string;
    signature: string;
    displayName: string;
    role: "CLIENT" | "FREELANCER";
    requestId: string;
  }) {
    const challenge = await this.repository.findChallenge(input.challengeId);
    const now = this.now();
    if (
      !challenge ||
      challenge.consumedAt ||
      challenge.expiresAt <= now ||
      challenge.address !== input.walletAddress ||
      challenge.messageHash !== sha256(input.message)
    )
      throw new AuthError("INVALID_CHALLENGE");
    let valid = false;
    try {
      valid = nacl.sign.detached.verify(
        new TextEncoder().encode(input.message),
        bs58.decode(input.signature),
        bs58.decode(input.walletAddress),
      );
    } catch {
      valid = false;
    }
    if (!valid) throw new AuthError("INVALID_SIGNATURE");
    if (!(await this.repository.consumeChallenge(challenge.id, now)))
      throw new AuthError("INVALID_CHALLENGE");
    let profile = await this.repository.findProfileByWallet(
      this.config.cluster,
      input.walletAddress,
    );
    if (profile && profile.tenantId !== challenge.tenantId)
      throw new AuthError("INVALID_CHALLENGE");
    profile ??= await this.repository.createProfileWithWallet({
      tenantId: challenge.tenantId,
      address: input.walletAddress,
      cluster: this.config.cluster,
      displayName: input.displayName,
      role: input.role,
    });
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.valueOf() + 7 * 24 * 60 * 60 * 1000);
    await this.repository.createSession({
      profileId: profile.id,
      tokenHash: sessionHash(token, this.config.sessionSecret),
      expiresAt,
    });
    await this.repository.audit({
      tenantId: profile.tenantId,
      actorId: profile.id,
      action: "auth.wallet_verified",
      targetType: "Wallet",
      requestId: input.requestId,
    });
    return { token, expiresAt, profile };
  }

  async authenticate(token?: string): Promise<AuthProfile> {
    if (!token) throw new AuthError("UNAUTHENTICATED");
    const profile = await this.repository.findProfileBySession(
      sessionHash(token, this.config.sessionSecret),
      this.now(),
    );
    if (!profile) throw new AuthError("UNAUTHENTICATED");
    return profile;
  }

  async logout(token: string | undefined) {
    if (token)
      await this.repository.revokeSession(
        sessionHash(token, this.config.sessionSecret),
      );
  }
}
