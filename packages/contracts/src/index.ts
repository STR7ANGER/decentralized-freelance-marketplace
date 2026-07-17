import { z } from "zod";

export const walletAddressSchema = z.string().trim().min(32).max(44);
export const challengeRequestSchema = z.object({
  walletAddress: walletAddressSchema,
  tenantSlug: z.string().trim().min(2).max(50),
});
export const verifyWalletSchema = z.object({
  challengeId: z.string().min(1),
  walletAddress: walletAddressSchema,
  message: z.string().min(1).max(1000),
  signature: z.string().min(1).max(128),
  displayName: z.string().trim().min(2).max(80),
  role: z.enum(["CLIENT", "FREELANCER"]),
});
export const createJobSchema = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(30).max(10_000),
  category: z.string().trim().min(2).max(60),
  skills: z.array(z.string().trim().min(1).max(40)).min(1).max(15),
  budgetMinor: z.string().regex(/^\d+$/),
  currency: z.string().trim().length(3),
  publish: z.boolean().default(true),
});
export const jobFilterSchema = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
  minBudgetMinor: z.string().regex(/^\d+$/).optional(),
  maxBudgetMinor: z.string().regex(/^\d+$/).optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});
export const saveSearchSchema = z.object({
  name: z.string().trim().min(2).max(60),
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
  minBudgetMinor: z.string().regex(/^\d+$/).optional(),
  maxBudgetMinor: z.string().regex(/^\d+$/).optional(),
});
export const milestoneDraftSchema = z
  .array(
    z.object({
      title: z.string().trim().min(3).max(120),
      amountMinor: z.string().regex(/^\d+$/),
      dueAt: z.string().datetime(),
    }),
  )
  .min(1)
  .max(20);
export const proposalSchema = z.object({
  jobId: z.string().min(1),
  coverLetter: z.string().trim().min(30).max(5000),
  totalAmountMinor: z.string().regex(/^\d+$/),
  currency: z.string().trim().length(3),
  deliveryDays: z.number().int().min(1).max(730),
  milestones: milestoneDraftSchema,
  expectedVersion: z.number().int().positive().optional(),
});
export const messageSchema = z.object({
  jobId: z.string().min(1),
  proposalId: z.string().min(1).optional(),
  body: z.string().trim().min(1).max(5000),
});
export const acceptProposalSchema = z.object({
  proposalId: z.string().min(1),
  expectedVersion: z.number().int().positive(),
});
export const agreeContractSchema = z.object({
  contractId: z.string().min(1),
  termsHash: z.string().regex(/^[a-f0-9]{64}$/),
  signature: z.string().min(1).max(128),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type JobFilter = z.infer<typeof jobFilterSchema>;
