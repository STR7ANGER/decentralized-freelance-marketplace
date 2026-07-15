import { createJobSchema, jobFilterSchema } from "@marketplace/contracts";
import type { AuthProfile } from "../auth/repository.js";
import type { JobRepository, JobView } from "./ports.js";

export class JobError extends Error {
  constructor(
    readonly code: "TENANT_NOT_FOUND" | "FORBIDDEN" | "INVALID_BUDGET",
  ) {
    super(code);
  }
}
export type JobTelemetry = {
  record(event: {
    name: "job.created" | "jobs.searched";
    tenantId: string;
    resultCount?: number;
    published?: boolean;
  }): void;
};
const serialize = (job: JobView) => ({
  ...job,
  budgetMinor: job.budgetMinor.toString(),
  createdAt: job.createdAt.toISOString(),
});

export class JobService {
  constructor(
    private readonly repository: JobRepository,
    private readonly telemetry: JobTelemetry = { record: () => {} },
  ) {}
  async create(profile: AuthProfile, raw: unknown, requestId: string) {
    if (profile.role !== "CLIENT" && profile.role !== "ADMIN")
      throw new JobError("FORBIDDEN");
    const input = createJobSchema.parse(raw);
    const budgetMinor = BigInt(input.budgetMinor);
    if (budgetMinor <= 0n) throw new JobError("INVALID_BUDGET");
    const job = await this.repository.create({
      tenantId: profile.tenantId,
      clientId: profile.id,
      title: input.title,
      description: input.description,
      category: input.category,
      skills: [...new Set(input.skills.map((skill) => skill.toLowerCase()))],
      budgetMinor,
      currency: input.currency.toUpperCase(),
      status: input.publish ? "PUBLISHED" : "DRAFT",
    });
    await this.repository.audit({
      tenantId: profile.tenantId,
      actorId: profile.id,
      action: "job.created",
      targetId: job.id,
      requestId,
    });
    this.telemetry.record({
      name: "job.created",
      tenantId: profile.tenantId,
      published: job.status === "PUBLISHED",
    });
    return serialize(job);
  }
  async search(tenantSlug: string, raw: unknown) {
    const tenant = await this.repository.findTenant(tenantSlug);
    if (!tenant) throw new JobError("TENANT_NOT_FOUND");
    const filter = jobFilterSchema.parse(raw ?? {});
    const result = await this.repository.search({
      tenantId: tenant.id,
      limit: filter.limit,
      ...(filter.search ? { search: filter.search } : {}),
      ...(filter.category ? { category: filter.category } : {}),
      ...(filter.minBudgetMinor
        ? { minBudgetMinor: BigInt(filter.minBudgetMinor) }
        : {}),
      ...(filter.maxBudgetMinor
        ? { maxBudgetMinor: BigInt(filter.maxBudgetMinor) }
        : {}),
      ...(filter.cursor ? { cursor: filter.cursor } : {}),
    });
    this.telemetry.record({
      name: "jobs.searched",
      tenantId: tenant.id,
      resultCount: result.jobs.length,
    });
    return { jobs: result.jobs.map(serialize), nextCursor: result.nextCursor };
  }
}
