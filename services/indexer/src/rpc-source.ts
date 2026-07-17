import type { ChainObservation, ChainSource, Confirmation } from "./types.js";

type SignatureInfo = {
  signature: string;
  slot: number;
  err: unknown;
  confirmationStatus?: "processed" | "confirmed" | "finalized";
};

export class SolanaRpcSource implements ChainSource {
  constructor(
    private readonly rpcUrl: string,
    private readonly programId: string,
    private readonly request: typeof fetch = fetch,
  ) {}

  private async rpc<T>(method: string, params: unknown[]): Promise<T> {
    const response = await this.request(this.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    if (!response.ok) throw new Error(`RPC_HTTP_${response.status}`);
    const body = (await response.json()) as {
      result?: T;
      error?: { message: string };
    };
    if (body.error || body.result === undefined)
      throw new Error(`RPC_ERROR:${body.error?.message ?? "missing result"}`);
    return body.result;
  }

  async observations(limit: number): Promise<ChainObservation[]> {
    const signatures = await this.rpc<SignatureInfo[]>(
      "getSignaturesForAddress",
      [this.programId, { limit, commitment: "confirmed" }],
    );
    const batches = await Promise.all(
      signatures.map(async (info) => {
        const transaction = await this.rpc<{
          blockTime: number | null;
          meta: { err: unknown; logMessages: string[] | null } | null;
          transaction: {
            message: { accountKeys: Array<string | { pubkey: string }> };
          };
        } | null>("getTransaction", [
          info.signature,
          { encoding: "json", maxSupportedTransactionVersion: 0 },
        ]);
        if (!transaction) return [];
        const participants = transaction.transaction.message.accountKeys
          .map((account) =>
            typeof account === "string" ? account : account.pubkey,
          )
          .filter((address) => address !== this.programId)
          .slice(0, 32);
        const confirmation: Confirmation =
          info.err || transaction.meta?.err
            ? "FAILED"
            : ((info.confirmationStatus?.toUpperCase() as Confirmation) ??
              "PROCESSED");
        const dataLogs = (transaction.meta?.logMessages ?? []).filter((log) =>
          log.startsWith("Program data: "),
        );
        const base = {
          signature: info.signature,
          programId: this.programId,
          slot: BigInt(info.slot),
          confirmation,
          participantAddresses: participants,
          ...(transaction.blockTime
            ? { blockTime: new Date(transaction.blockTime * 1_000) }
            : {}),
        };
        return [
          { ...base, eventIndex: -1, eventType: "ESCROW_TRANSACTION" },
          ...dataLogs.map((log, eventIndex) => ({
            ...base,
            eventIndex,
            eventType: "ANCHOR_EVENT",
            payload: { data: log.slice("Program data: ".length, 160) },
          })),
        ];
      }),
    );
    return batches.flat();
  }
}
