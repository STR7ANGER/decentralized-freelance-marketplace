"use client";

import type { WalletConnector } from "@solana/client";
import { useWalletConnection } from "@solana/react-hooks";
import bs58 from "bs58";
import { useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
export function WalletAccess() {
  const connection = useWalletConnection();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const signIn = async () => {
    if (!connection.wallet?.signMessage) {
      setStatus("This wallet does not support message signing.");
      return;
    }
    setBusy(true);
    setStatus("Preparing a single-use sign-in message…");
    try {
      const walletAddress = connection.wallet.account.address.toString();
      const challengeResponse = await fetch(`${apiUrl}/v1/auth/challenge`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ walletAddress, tenantSlug: "demo" }),
      });
      if (!challengeResponse.ok) throw new Error("Challenge unavailable");
      const challenge = (await challengeResponse.json()) as {
        challengeId: string;
        message: string;
      };
      const signature = await connection.wallet.signMessage(
        new TextEncoder().encode(challenge.message),
      );
      const verifyResponse = await fetch(`${apiUrl}/v1/auth/verify`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          walletAddress,
          message: challenge.message,
          signature: bs58.encode(signature),
          displayName: "New member",
          role: "FREELANCER",
        }),
      });
      if (!verifyResponse.ok) throw new Error("Signature rejected");
      setStatus("Wallet verified. No transaction was submitted.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Wallet sign-in failed",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="wallet-panel" aria-labelledby="wallet-title">
      <div>
        <p className="eyebrow">WALLET ACCESS</p>
        <h2 id="wallet-title">Sign in without surrendering custody.</h2>
        <p>
          A signed nonce proves wallet control. It cannot transfer SOL, approve
          escrow, or expose a private key.
        </p>
      </div>
      <div className="wallet-actions">
        {!connection.isReady ? (
          <span>Discovering wallets…</span>
        ) : connection.connected ? (
          <>
            <code>
              {connection.wallet?.account.address.toString().slice(0, 8)}…
            </code>
            <button type="button" onClick={signIn} disabled={busy}>
              {busy ? "Waiting for signature…" : "Verify wallet"}
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => connection.disconnect()}
            >
              Disconnect
            </button>
          </>
        ) : connection.connectors.length ? (
          connection.connectors.map((connector: WalletConnector) => (
            <button
              type="button"
              key={connector.id}
              disabled={connection.connecting}
              onClick={() => connection.connect(connector.id)}
            >
              {connection.connecting
                ? "Connecting…"
                : `Connect ${connector.name}`}
            </button>
          ))
        ) : (
          <span>No Wallet Standard wallet detected.</span>
        )}
        <p aria-live="polite">{status}</p>
      </div>
    </section>
  );
}
