import { prisma } from "../../db.js";
import type {
  AuthProfile,
  AuthRepository,
  StoredChallenge,
} from "./repository.js";

const view = (row: {
  id: string;
  tenantId: string;
  displayName: string;
  role: "CLIENT" | "FREELANCER" | "RESOLVER" | "ADMIN";
  wallets: Array<{ address: string }>;
}): AuthProfile => ({
  id: row.id,
  tenantId: row.tenantId,
  displayName: row.displayName,
  role: row.role,
  walletAddress: row.wallets[0]?.address ?? "",
});

export class PrismaAuthRepository implements AuthRepository {
  findTenant(slug: string) {
    return prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, slug: true },
    });
  }
  async createChallenge(input: Omit<StoredChallenge, "consumedAt">) {
    await prisma.walletNonce.create({ data: input });
  }
  findChallenge(id: string) {
    return prisma.walletNonce.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        address: true,
        nonceHash: true,
        messageHash: true,
        expiresAt: true,
        consumedAt: true,
      },
    });
  }
  async consumeChallenge(id: string, now: Date) {
    const result = await prisma.walletNonce.updateMany({
      where: { id, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    return result.count === 1;
  }
  async findProfileByWallet(cluster: string, address: string) {
    const wallet = await prisma.wallet.findUnique({
      where: { cluster_address: { cluster, address } },
      select: {
        profile: {
          select: {
            id: true,
            tenantId: true,
            displayName: true,
            role: true,
            wallets: { select: { address: true }, take: 1 },
          },
        },
      },
    });
    return wallet ? view(wallet.profile) : null;
  }
  async createProfileWithWallet(input: {
    tenantId: string;
    address: string;
    cluster: string;
    displayName: string;
    role: "CLIENT" | "FREELANCER";
  }) {
    const profile = await prisma.userProfile.create({
      data: {
        tenantId: input.tenantId,
        displayName: input.displayName,
        role: input.role,
        wallets: { create: { address: input.address, cluster: input.cluster } },
      },
      select: {
        id: true,
        tenantId: true,
        displayName: true,
        role: true,
        wallets: { select: { address: true }, take: 1 },
      },
    });
    return view(profile);
  }
  async createSession(input: {
    profileId: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    await prisma.session.create({ data: input });
  }
  async findProfileBySession(tokenHash: string, now: Date) {
    const session = await prisma.session.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: now } },
      select: {
        profile: {
          select: {
            id: true,
            tenantId: true,
            displayName: true,
            role: true,
            wallets: { select: { address: true }, take: 1 },
          },
        },
      },
    });
    return session ? view(session.profile) : null;
  }
  async revokeSession(tokenHash: string) {
    await prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  async audit(input: {
    tenantId: string;
    actorId?: string;
    action: string;
    targetType: string;
    targetId?: string;
    requestId: string;
  }) {
    await prisma.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        action: input.action,
        targetType: input.targetType,
        requestId: input.requestId,
        ...(input.actorId ? { actorId: input.actorId } : {}),
        ...(input.targetId ? { targetId: input.targetId } : {}),
      },
    });
  }
}
