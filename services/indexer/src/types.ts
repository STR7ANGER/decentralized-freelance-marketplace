export type Confirmation = "PROCESSED" | "CONFIRMED" | "FINALIZED" | "FAILED";

export type ChainObservation = {
  signature: string;
  eventIndex: number;
  programId: string;
  slot: bigint;
  confirmation: Confirmation;
  eventType: string;
  participantAddresses: string[];
  payload?: Record<string, string | number | boolean | null>;
  blockTime?: Date;
};

export type ChainEventView = ChainObservation & {
  id: string;
  observedAt: Date;
  updatedAt: Date;
};

export interface ChainEventRepository {
  save(observation: ChainObservation): Promise<ChainEventView>;
  history(participantAddress: string, limit: number): Promise<ChainEventView[]>;
}

export interface ChainSource {
  observations(limit: number): Promise<ChainObservation[]>;
}
