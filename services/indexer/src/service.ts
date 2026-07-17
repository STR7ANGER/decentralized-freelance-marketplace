import type {
  ChainEventRepository,
  ChainEventView,
  ChainSource,
  Confirmation,
} from "./types.js";

const rank: Record<Confirmation, number> = {
  PROCESSED: 0,
  CONFIRMED: 1,
  FINALIZED: 2,
  FAILED: 3,
};

export const laterConfirmation = (
  current: Confirmation,
  observed: Confirmation,
) => (rank[observed] >= rank[current] ? observed : current);

export class EventIndexer {
  constructor(
    private readonly source: ChainSource,
    private readonly repository: ChainEventRepository,
    private readonly telemetry: {
      record(event: Record<string, unknown>): void;
    } = { record: () => undefined },
  ) {}

  async sync(limit = 50) {
    const observations = await this.source.observations(Math.min(100, limit));
    for (const observation of observations)
      await this.repository.save(observation);
    this.telemetry.record({
      event: "indexer.sync",
      observations: observations.length,
    });
    return observations.length;
  }
}

export class TransactionHistoryService {
  constructor(private readonly repository: ChainEventRepository) {}

  history(walletAddress: string, limit = 30): Promise<ChainEventView[]> {
    return this.repository.history(
      walletAddress,
      Math.min(100, Math.max(1, limit)),
    );
  }
}
