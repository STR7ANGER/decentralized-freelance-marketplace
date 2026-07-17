import { describe, expect, it } from "vitest";
import { SolanaRpcSource } from "../src/rpc-source.js";

const response = (result: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 503, json: async () => ({ result }) }) as Response;

describe("Solana RPC source", () => {
  it("normalizes failed transactions and bounds untrusted event data", async () => {
    const request = async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      const body = JSON.parse(String(init?.body)) as { method: string };
      if (body.method === "getSignaturesForAddress")
        return response([
          {
            signature: "sig-1",
            slot: 99,
            err: { custom: 1 },
            confirmationStatus: "confirmed",
          },
        ]);
      return response({
        blockTime: 1_700_000_000,
        meta: {
          err: { custom: 1 },
          logMessages: [`Program data: ${"a".repeat(500)}`],
        },
        transaction: {
          message: { accountKeys: ["program", "client", "freelancer"] },
        },
      });
    };
    const events = await new SolanaRpcSource(
      "http://localhost:8899",
      "program",
      request as typeof fetch,
    ).observations(10);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ confirmation: "FAILED", eventIndex: -1 });
    expect(JSON.stringify(events[1]?.payload).length).toBeLessThan(200);
    expect(events[0]?.participantAddresses).toEqual(["client", "freelancer"]);
  });

  it("fails closed on RPC transport errors", async () => {
    const request = async () => response(undefined, false);
    await expect(
      new SolanaRpcSource(
        "http://localhost:8899",
        "program",
        request as typeof fetch,
      ).observations(10),
    ).rejects.toThrow("RPC_HTTP_503");
  });
});
