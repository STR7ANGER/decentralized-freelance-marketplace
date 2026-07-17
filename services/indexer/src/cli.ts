import { z } from "zod";
import { PrismaChainEventRepository } from "./prisma-repository.js";
import { SolanaRpcSource } from "./rpc-source.js";
import { EventIndexer } from "./service.js";

const environment = z
  .object({
    SOLANA_RPC_URL: z.string().url(),
    ESCROW_PROGRAM_ID: z.string().min(32).max(44),
    INDEX_INTERVAL_MS: z.coerce.number().int().min(1_000).default(5_000),
  })
  .parse(process.env);
const indexer = new EventIndexer(
  new SolanaRpcSource(
    environment.SOLANA_RPC_URL,
    environment.ESCROW_PROGRAM_ID,
  ),
  new PrismaChainEventRepository(),
  {
    record: (event) =>
      console.info(JSON.stringify({ level: "info", ...event })),
  },
);

const run = async () => {
  try {
    await indexer.sync();
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "indexer.failed",
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
  }
};
await run();
setInterval(run, environment.INDEX_INTERVAL_MS);
