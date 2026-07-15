import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  WEB_URL: z.string().url(),
  API_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),
  MONGODB_URI: z.string().min(1),
  REDIS_URL: z.string().min(1),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(8),
  SESSION_SECRET: z.string().min(32),
  SOLANA_CLUSTER: z.enum(["localnet", "devnet"]),
  SOLANA_RPC_URL: z.string().url(),
  AUTH_DOMAIN: z.string().min(1),
  AUTH_NONCE_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(300),
});

export const parseEnvironment = (environment: NodeJS.ProcessEnv) =>
  schema.parse(environment);
export type Environment = z.infer<typeof schema>;
