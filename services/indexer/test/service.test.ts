import { describe, expect, it } from "vitest";
import { EventIndexer, laterConfirmation } from "../src/service.js";
import type {
  ChainEventRepository,
  ChainEventView,
  ChainObservation,
} from "../src/types.js";

class MemoryRepository implements ChainEventRepository {
  events = new Map<string, ChainEventView>();
  async save(observation: ChainObservation) {
    const key = `${observation.signature}:${observation.eventIndex}`;
    const current = this.events.get(key);
    const now = new Date("2026-07-18T00:00:00Z");
    const event = {
      ...observation,
      id: current?.id ?? key,
      confirmation: current
        ? laterConfirmation(current.confirmation, observation.confirmation)
        : observation.confirmation,
      observedAt: current?.observedAt ?? now,
      updatedAt: now,
    };
    this.events.set(key, event);
    return event;
  }
  async history(address: string, limit: number) {
    return [...this.events.values()]
      .filter((event) => event.participantAddresses.includes(address))
      .slice(0, limit);
  }
}

const observation: ChainObservation = {
  signature: "signature",
  eventIndex: -1,
  programId: "program",
  slot: 42n,
  confirmation: "CONFIRMED",
  eventType: "ESCROW_TRANSACTION",
  participantAddresses: ["client"],
};

describe("event indexer", () => {
  it("is idempotent and advances confirmations without duplicates", async () => {
    const repository = new MemoryRepository();
    const source = { observations: async () => [observation] };
    const indexer = new EventIndexer(source, repository);
    await indexer.sync();
    await indexer.sync();
    expect(repository.events.size).toBe(1);
    await repository.save({ ...observation, confirmation: "FINALIZED" });
    await repository.save({ ...observation, confirmation: "PROCESSED" });
    expect([...repository.events.values()][0]?.confirmation).toBe("FINALIZED");
  });

  it("returns only events involving the authenticated wallet", async () => {
    const repository = new MemoryRepository();
    await repository.save(observation);
    await repository.save({
      ...observation,
      signature: "other",
      participantAddresses: ["freelancer"],
    });
    expect(await repository.history("client", 10)).toHaveLength(1);
  });

  it("bounds batches and reports only aggregate telemetry", async () => {
    const repository = new MemoryRepository();
    const limits: number[] = [];
    const telemetry: Array<Record<string, unknown>> = [];
    const indexer = new EventIndexer(
      {
        observations: async (limit) => {
          limits.push(limit);
          return [observation];
        },
      },
      repository,
      { record: (event) => telemetry.push(event) },
    );
    expect(await indexer.sync(500)).toBe(1);
    expect(limits).toEqual([100]);
    expect(telemetry).toEqual([{ event: "indexer.sync", observations: 1 }]);
    expect(JSON.stringify(telemetry)).not.toContain("signature");
  });
});
