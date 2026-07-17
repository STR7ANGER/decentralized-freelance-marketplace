"use client";

import { useState } from "react";

type Proposal = {
  id: string;
  freelancerName: string;
  coverLetter: string;
  totalAmountMinor: string;
  currency: string;
  deliveryDays: number;
  status: string;
  version: number;
  termsHash: string;
  milestones: Array<{ title: string; amountMinor: string; dueAt: string }>;
};
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const comparisonQuery = `query Proposals($jobId:ID!){proposals(jobId:$jobId){id freelancerName coverLetter totalAmountMinor currency deliveryDays status version termsHash milestones{title amountMinor dueAt}}}`;
const submitMutation = `mutation Submit($input:ProposalInput!){submitProposal(input:$input){id version termsHash status}}`;
export function ProposalWorkspace({ jobId }: { jobId: string }) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [compareStatus, setCompareStatus] = useState("");
  const [submitStatus, setSubmitStatus] = useState("");
  const compare = async () => {
    setCompareStatus("Loading proposals…");
    const response = await fetch(`${apiUrl}/graphql`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: comparisonQuery, variables: { jobId } }),
    });
    const payload = await response.json();
    if (!payload.data) {
      setCompareStatus("Only this job’s client can compare proposals.");
      return;
    }
    setProposals(payload.data.proposals);
    setCompareStatus(payload.data.proposals.length ? "" : "No proposals yet.");
  };
  return (
    <div className="proposal-layout">
      <section className="dashboard-panel">
        <h2>Submit milestone terms</h2>
        <form
          className="job-form compact"
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const amountMinor = String(
              Math.round(Number(data.get("amount")) * 100),
            );
            setSubmitStatus("Submitting…");
            const response = await fetch(`${apiUrl}/graphql`, {
              method: "POST",
              credentials: "include",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                query: submitMutation,
                variables: {
                  input: {
                    jobId,
                    coverLetter: data.get("coverLetter"),
                    totalAmountMinor: amountMinor,
                    currency: "USD",
                    deliveryDays: Number(data.get("deliveryDays")),
                    milestones: [
                      {
                        title: data.get("milestone"),
                        amountMinor,
                        dueAt: new Date(
                          String(data.get("dueAt")),
                        ).toISOString(),
                      },
                    ],
                  },
                },
              }),
            });
            const payload = await response.json();
            setSubmitStatus(
              payload.data
                ? `Proposal submitted at version ${payload.data.submitProposal.version}.`
                : (payload.errors?.[0]?.message ?? "Proposal failed."),
            );
          }}
        >
          <label>
            Cover letter
            <textarea
              name="coverLetter"
              minLength={30}
              maxLength={5000}
              rows={5}
              required
            />
          </label>
          <label>
            Delivery days
            <input
              name="deliveryDays"
              type="number"
              min="1"
              max="730"
              required
            />
          </label>
          <label>
            Milestone title
            <input name="milestone" minLength={3} maxLength={120} required />
          </label>
          <label>
            Milestone amount (USD)
            <input name="amount" type="number" min="1" step="0.01" required />
          </label>
          <label>
            Due date
            <input name="dueAt" type="date" required />
          </label>
          <button type="submit">Submit proposal</button>
          <p aria-live="polite">{submitStatus}</p>
        </form>
      </section>
      <section className="dashboard-panel">
        <div className="metric-row">
          <h2>Client comparison</h2>
          <button type="button" className="secondary" onClick={compare}>
            Load proposals
          </button>
        </div>
        <p aria-live="polite">{compareStatus}</p>
        <div className="proposal-list">
          {proposals.map((proposal) => (
            <article key={proposal.id}>
              <div className="metric-row">
                <strong>{proposal.freelancerName}</strong>
                <span>
                  {new Intl.NumberFormat("en", {
                    style: "currency",
                    currency: proposal.currency,
                  }).format(Number(proposal.totalAmountMinor) / 100)}
                </span>
              </div>
              <p>{proposal.coverLetter}</p>
              <small>
                {proposal.deliveryDays} days · version {proposal.version} ·{" "}
                {proposal.status.toLowerCase()}
              </small>
              <ul>
                {proposal.milestones.map((milestone) => (
                  <li key={milestone.title}>
                    {milestone.title}:{" "}
                    {new Intl.NumberFormat("en", {
                      style: "currency",
                      currency: proposal.currency,
                    }).format(Number(milestone.amountMinor) / 100)}
                  </li>
                ))}
              </ul>
              <code title={proposal.termsHash}>
                {proposal.termsHash.slice(0, 16)}…
              </code>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
