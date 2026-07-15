export type AuthProfile = {
  id: string;
  tenantId: string;
  displayName: string;
  role: "CLIENT" | "FREELANCER" | "RESOLVER" | "ADMIN";
  walletAddress: string;
};
export type StoredChallenge = {
  id: string;
  tenantId: string;
  address: string;
  nonceHash: string;
  messageHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
};

export interface AuthRepository {
  findTenant(slug: string): Promise<{ id: string; slug: string } | null>;
  createChallenge(input: Omit<StoredChallenge, "consumedAt">): Promise<void>;
  findChallenge(id: string): Promise<StoredChallenge | null>;
  consumeChallenge(id: string, now: Date): Promise<boolean>;
  findProfileByWallet(
    cluster: string,
    address: string,
  ): Promise<AuthProfile | null>;
  createProfileWithWallet(input: {
    tenantId: string;
    address: string;
    cluster: string;
    displayName: string;
    role: "CLIENT" | "FREELANCER";
  }): Promise<AuthProfile>;
  createSession(input: {
    profileId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  findProfileBySession(
    tokenHash: string,
    now: Date,
  ): Promise<AuthProfile | null>;
  revokeSession(tokenHash: string): Promise<void>;
  audit(input: {
    tenantId: string;
    actorId?: string;
    action: string;
    targetType: string;
    targetId?: string;
    requestId: string;
  }): Promise<void>;
}
