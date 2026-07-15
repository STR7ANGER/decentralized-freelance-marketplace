export type JobView = {
  id: string;
  tenantId: string;
  clientId: string;
  clientName: string;
  title: string;
  description: string;
  category: string;
  skills: string[];
  budgetMinor: bigint;
  currency: string;
  status: string;
  createdAt: Date;
};
export type JobSearch = {
  tenantId: string;
  search?: string;
  category?: string;
  minBudgetMinor?: bigint;
  maxBudgetMinor?: bigint;
  cursor?: string;
  limit: number;
};
export type SavedSearchView = {
  id: string;
  name: string;
  search: string | null;
  category: string | null;
  minBudgetMinor: bigint | null;
  maxBudgetMinor: bigint | null;
  createdAt: Date;
};

export interface JobRepository {
  findTenant(slug: string): Promise<{ id: string } | null>;
  create(input: {
    tenantId: string;
    clientId: string;
    title: string;
    description: string;
    category: string;
    skills: string[];
    budgetMinor: bigint;
    currency: string;
    status: "DRAFT" | "PUBLISHED";
  }): Promise<JobView>;
  search(
    input: JobSearch,
  ): Promise<{ jobs: JobView[]; nextCursor: string | null }>;
  saveSearch(input: {
    tenantId: string;
    profileId: string;
    name: string;
    search?: string;
    category?: string;
    minBudgetMinor?: bigint;
    maxBudgetMinor?: bigint;
  }): Promise<SavedSearchView>;
  savedSearches(
    tenantId: string,
    profileId: string,
  ): Promise<SavedSearchView[]>;
  audit(input: {
    tenantId: string;
    actorId: string;
    action: string;
    targetId: string;
    requestId: string;
  }): Promise<void>;
}
