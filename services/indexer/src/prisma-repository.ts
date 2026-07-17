import { Prisma, PrismaClient } from "@prisma/client";
import { laterConfirmation } from "./service.js";
import type {
  ChainEventRepository,
  ChainEventView,
  ChainObservation,
} from "./types.js";

const prisma = new PrismaClient();
const view = (row: {
  id: string;
  signature: string;
  eventIndex: number;
  programId: string;
  slot: bigint;
  confirmation: ChainObservation["confirmation"];
  eventType: string;
  participantAddresses: string[];
  payload: Prisma.JsonValue | null;
  blockTime: Date | null;
  observedAt: Date;
  updatedAt: Date;
}): ChainEventView => ({
  id: row.id,
  signature: row.signature,
  eventIndex: row.eventIndex,
  programId: row.programId,
  slot: row.slot,
  confirmation: row.confirmation,
  eventType: row.eventType,
  participantAddresses: row.participantAddresses,
  ...(row.payload
    ? {
        payload: row.payload as NonNullable<ChainObservation["payload"]>,
      }
    : {}),
  ...(row.blockTime ? { blockTime: row.blockTime } : {}),
  observedAt: row.observedAt,
  updatedAt: row.updatedAt,
});

export class PrismaChainEventRepository implements ChainEventRepository {
  async save(observation: ChainObservation) {
    const row = await prisma.$transaction(async (database) => {
      const key = {
        signature_eventIndex: {
          signature: observation.signature,
          eventIndex: observation.eventIndex,
        },
      };
      const current = await database.chainEvent.findUnique({ where: key });
      const data = {
        ...observation,
        confirmation: current
          ? laterConfirmation(current.confirmation, observation.confirmation)
          : observation.confirmation,
        payload: observation.payload ?? Prisma.JsonNull,
        blockTime: observation.blockTime ?? null,
      };
      return database.chainEvent.upsert({
        where: key,
        create: data,
        update: data,
      });
    });
    return view(row);
  }

  async history(participantAddress: string, limit: number) {
    const rows = await prisma.chainEvent.findMany({
      where: { participantAddresses: { has: participantAddress } },
      orderBy: [{ slot: "desc" }, { eventIndex: "asc" }],
      take: limit,
    });
    return rows.map(view);
  }
}
