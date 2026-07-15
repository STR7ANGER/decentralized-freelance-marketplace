import type { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import type { JobRepository, JobSearch } from "./ports.js";

const selection = {
  id: true,
  tenantId: true,
  clientId: true,
  title: true,
  description: true,
  category: true,
  skills: true,
  budgetMinor: true,
  currency: true,
  status: true,
  createdAt: true,
  client: { select: { displayName: true } },
} as const;
type SelectedJob = Prisma.JobGetPayload<{ select: typeof selection }>;
const view = (row: SelectedJob) => ({
  id: row.id,
  tenantId: row.tenantId,
  clientId: row.clientId,
  clientName: row.client.displayName,
  title: row.title,
  description: row.description,
  category: row.category,
  skills: row.skills,
  budgetMinor: row.budgetMinor,
  currency: row.currency,
  status: row.status,
  createdAt: row.createdAt,
});

export class PrismaJobRepository implements JobRepository {
  findTenant(slug: string) {
    return prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  }
  async create(input: {
    tenantId: string;
    clientId: string;
    title: string;
    description: string;
    category: string;
    skills: string[];
    budgetMinor: bigint;
    currency: string;
    status: "DRAFT" | "PUBLISHED";
  }) {
    const row = await prisma.job.create({ data: input, select: selection });
    return view(row);
  }
  async search(input: JobSearch) {
    const rows = await prisma.job.findMany({
      where: {
        tenantId: input.tenantId,
        status: "PUBLISHED",
        ...(input.search
          ? {
              OR: [
                { title: { contains: input.search, mode: "insensitive" } },
                {
                  description: { contains: input.search, mode: "insensitive" },
                },
                { skills: { has: input.search.toLowerCase() } },
              ],
            }
          : {}),
        ...(input.category
          ? { category: { equals: input.category, mode: "insensitive" } }
          : {}),
        ...(input.minBudgetMinor !== undefined ||
        input.maxBudgetMinor !== undefined
          ? {
              budgetMinor: {
                ...(input.minBudgetMinor !== undefined
                  ? { gte: input.minBudgetMinor }
                  : {}),
                ...(input.maxBudgetMinor !== undefined
                  ? { lte: input.maxBudgetMinor }
                  : {}),
              },
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: selection,
    });
    const hasMore = rows.length > input.limit;
    const page = hasMore ? rows.slice(0, input.limit) : rows;
    return {
      jobs: page.map(view),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }
  saveSearch(input: {
    tenantId: string;
    profileId: string;
    name: string;
    search?: string;
    category?: string;
    minBudgetMinor?: bigint;
    maxBudgetMinor?: bigint;
  }) {
    const values = {
      tenantId: input.tenantId,
      profileId: input.profileId,
      name: input.name,
      search: input.search ?? null,
      category: input.category ?? null,
      minBudgetMinor: input.minBudgetMinor ?? null,
      maxBudgetMinor: input.maxBudgetMinor ?? null,
    };
    return prisma.savedSearch.upsert({
      where: {
        profileId_name: { profileId: input.profileId, name: input.name },
      },
      update: values,
      create: values,
      select: {
        id: true,
        name: true,
        search: true,
        category: true,
        minBudgetMinor: true,
        maxBudgetMinor: true,
        createdAt: true,
      },
    });
  }
  savedSearches(tenantId: string, profileId: string) {
    return prisma.savedSearch.findMany({
      where: { tenantId, profileId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        search: true,
        category: true,
        minBudgetMinor: true,
        maxBudgetMinor: true,
        createdAt: true,
      },
    });
  }
  async audit(input: {
    tenantId: string;
    actorId: string;
    action: string;
    targetId: string;
    requestId: string;
  }) {
    await prisma.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        actorId: input.actorId,
        action: input.action,
        targetType: "Job",
        targetId: input.targetId,
        requestId: input.requestId,
      },
    });
  }
}
