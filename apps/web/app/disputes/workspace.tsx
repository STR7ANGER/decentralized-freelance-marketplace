"use client";

import { FormEvent, useEffect, useState } from "react";

type Dispute = {
  id: string;
  contractId: string;
  evidenceCid: string;
  status: string;
  createdAt: string;
};
const endpoint = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function DisputeWorkspace() {
  const [items, setItems] = useState<Dispute[]>([]);
  const [status, setStatus] = useState("Loading disputes…");
  const load = async () => {
    const response = await fetch(`${endpoint}/graphql`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query:
          "query { disputes { id contractId evidenceCid status createdAt } }",
      }),
    });
    const body = (await response.json()) as { data?: { disputes: Dispute[] } };
    if (!response.ok || !body.data)
      throw new Error("Sign in to view disputes.");
    setItems(body.data.disputes);
    setStatus(body.data.disputes.length ? "" : "No disputes for this wallet.");
  };
  useEffect(() => {
    void load().catch((error: Error) => setStatus(error.message));
  }, []);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("Validating evidence…");
    const values = new FormData(event.currentTarget);
    const response = await fetch(`${endpoint}/graphql`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query:
          "mutation Open($input: OpenDisputeInput!) { openDispute(input: $input) { id } }",
        variables: {
          input: {
            contractId: values.get("contractId"),
            evidenceCid: values.get("evidenceCid"),
            evidenceHash: values.get("evidenceHash"),
            privateNote: values.get("privateNote"),
          },
        },
      }),
    });
    const body = (await response.json()) as {
      errors?: Array<{ message: string }>;
    };
    if (!response.ok || body.errors) {
      setStatus(body.errors?.[0]?.message ?? "Could not open dispute.");
      return;
    }
    event.currentTarget.reset();
    await load();
  };
  return (
    <section className="proposal-layout">
      <form className="dashboard-panel job-form" onSubmit={submit}>
        <h2>Open a dispute</h2>
        <label>
          Contract ID
          <input required name="contractId" />
        </label>
        <label>
          IPFS CID
          <input required name="evidenceCid" />
        </label>
        <label>
          SHA-256 digest
          <input required name="evidenceHash" pattern="[a-f0-9]{64}" />
        </label>
        <label>
          Private resolver note
          <textarea name="privateNote" maxLength={2000} />
        </label>
        <button type="submit">Record evidence</button>
        <p aria-live="polite">{status}</p>
      </form>
      <section className="dashboard-panel proposal-list">
        <h2>Your cases</h2>
        {items.map((item) => (
          <article key={item.id}>
            <strong>{item.status}</strong>
            <p>Contract {item.contractId}</p>
            <small>{item.evidenceCid}</small>
          </article>
        ))}
      </section>
    </section>
  );
}
