"use client";

import { useEffect, useState } from "react";

type ChainEvent = {
  id: string;
  signature: string;
  eventIndex: number;
  slot: string;
  confirmation: "PROCESSED" | "CONFIRMED" | "FINALIZED" | "FAILED";
  eventType: string;
  blockTime: string | null;
};

const endpoint = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function TransactionHistory() {
  const [events, setEvents] = useState<ChainEvent[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`${endpoint}/graphql`, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            query: `query History { transactionHistory(limit: 50) { id signature eventIndex slot confirmation eventType blockTime } }`,
          }),
        });
        const body = (await response.json()) as {
          data?: { transactionHistory: ChainEvent[] };
          errors?: unknown[];
        };
        if (!response.ok || body.errors || !body.data)
          throw new Error("history");
        setEvents(body.data.transactionHistory);
        setState("ready");
      } catch {
        setState("error");
      }
    };
    void load();
  }, []);

  if (state === "loading")
    return <p className="notice">Loading indexed activity…</p>;
  if (state === "error")
    return (
      <p className="notice error">
        Sign in with your wallet and ensure the API and indexer are running.
      </p>
    );
  if (events.length === 0)
    return (
      <p className="notice">No indexed escrow activity for this wallet yet.</p>
    );

  return (
    <section className="transaction-list" aria-label="Transaction history">
      {events.map((event) => (
        <article key={event.id}>
          <div>
            <p className="eyebrow">{event.eventType.replaceAll("_", " ")}</p>
            <h2>{`${event.signature.slice(0, 12)}…${event.signature.slice(-8)}`}</h2>
            <small>
              Slot {event.slot} · event {event.eventIndex} ·{" "}
              {event.blockTime
                ? new Date(event.blockTime).toLocaleString()
                : "time pending"}
            </small>
          </div>
          <strong
            className={`confirmation ${event.confirmation.toLowerCase()}`}
          >
            {event.confirmation}
          </strong>
        </article>
      ))}
    </section>
  );
}
