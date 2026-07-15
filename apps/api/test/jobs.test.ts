import { describe, expect, it } from "vitest";
import type { AuthProfile } from "../src/modules/auth/repository.js";
import type {
  JobRepository,
  JobSearch,
  JobView,
} from "../src/modules/jobs/ports.js";
import { JobService } from "../src/modules/jobs/service.js";

class MemoryJobRepository implements JobRepository {
  rows: JobView[] = [];
  audits: string[] = [];
  async findTenant(slug: string) {
    return slug === "demo" ? { id: "tenant-1" } : null;
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
    const row = {
      id: `job-${this.rows.length + 1}`,
      clientName: "Client",
      createdAt: new Date("2026-07-16"),
      ...input,
    };
    this.rows.push(row);
    return row;
  }
  async search(input: JobSearch) {
    const rows = this.rows
      .filter(
        (row) =>
          row.tenantId === input.tenantId &&
          row.status === "PUBLISHED" &&
          (!input.search ||
            row.title.toLowerCase().includes(input.search.toLowerCase()) ||
            row.skills.includes(input.search.toLowerCase())),
      )
      .slice(0, input.limit);
    return { jobs: rows, nextCursor: null };
  }
  async audit(input: { action: string }) {
    this.audits.push(input.action);
  }
}
const client: AuthProfile = {
  id: "client-1",
  tenantId: "tenant-1",
  displayName: "Client",
  role: "CLIENT",
  walletAddress: "wallet",
};

describe("job marketplace", () => {
  it("publishes normalized, tenant-scoped jobs and discovers them", async () => {
    const repository = new MemoryJobRepository();
    const events: Array<Record<string, unknown>> = [];
    const service = new JobService(repository, {
      record: (event) => events.push(event),
    });
    const job = await service.create(
      client,
      {
        title: "Build a Solana dashboard",
        description:
          "Create an accessible dashboard for reviewed program activity.",
        category: "Engineering",
        skills: ["Rust", "rust", "Next.js"],
        budgetMinor: "250000",
        currency: "usd",
        publish: true,
      },
      "request-1",
    );
    expect(job).toMatchObject({
      budgetMinor: "250000",
      currency: "USD",
      skills: ["rust", "next.js"],
    });
    await expect(
      service.search("demo", { search: "rust", limit: 20 }),
    ).resolves.toMatchObject({ jobs: [{ id: "job-1" }] });
    expect(repository.audits).toEqual(["job.created"]);
    expect(JSON.stringify(events)).not.toContain("accessible dashboard");
  });

  it("enforces roles, positive budgets, and published-only discovery", async () => {
    const repository = new MemoryJobRepository();
    const service = new JobService(repository);
    const freelancer = { ...client, role: "FREELANCER" as const };
    await expect(
      service.create(
        freelancer,
        {
          title: "Forbidden job",
          description:
            "This description is intentionally long enough to validate.",
          category: "Design",
          skills: ["UI"],
          budgetMinor: "100",
          currency: "USD",
          publish: true,
        },
        "request",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      service.create(
        client,
        {
          title: "Invalid budget",
          description:
            "This description is intentionally long enough to validate.",
          category: "Design",
          skills: ["UI"],
          budgetMinor: "0",
          currency: "USD",
          publish: true,
        },
        "request",
      ),
    ).rejects.toMatchObject({ code: "INVALID_BUDGET" });
    await service.create(
      client,
      {
        title: "Private draft job",
        description:
          "This description is intentionally long enough to remain private.",
        category: "Design",
        skills: ["UI"],
        budgetMinor: "100",
        currency: "USD",
        publish: false,
      },
      "request",
    );
    await expect(service.search("demo", { limit: 20 })).resolves.toEqual({
      jobs: [],
      nextCursor: null,
    });
  });
});
