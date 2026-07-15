"use client";

import { autoDiscover, createClient } from "@solana/client";
import { SolanaProvider } from "@solana/react-hooks";
import type { ReactNode } from "react";

const endpoint =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "http://127.0.0.1:8899";
const websocketEndpoint =
  process.env.NEXT_PUBLIC_SOLANA_WS_URL ?? "ws://127.0.0.1:8900";
const client = createClient({
  endpoint,
  websocketEndpoint,
  walletConnectors: autoDiscover(),
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SolanaProvider client={client} walletPersistence={{ autoConnect: false }}>
      {children}
    </SolanaProvider>
  );
}
