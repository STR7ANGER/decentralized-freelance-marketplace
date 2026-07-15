"use client";

import { useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const mutation = `mutation CreateJob($input:CreateJobInput!){createJob(input:$input){id title status}}`;
export function NewJobForm() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="job-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage("");
        const data = new FormData(event.currentTarget);
        try {
          const response = await fetch(`${apiUrl}/graphql`, {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              query: mutation,
              variables: {
                input: {
                  title: data.get("title"),
                  description: data.get("description"),
                  category: data.get("category"),
                  skills: String(data.get("skills"))
                    .split(",")
                    .map((skill) => skill.trim())
                    .filter(Boolean),
                  budgetMinor: String(
                    Math.round(Number(data.get("budget")) * 100),
                  ),
                  currency: "USD",
                  publish: true,
                },
              },
            }),
          });
          const payload = await response.json();
          if (!payload.data)
            throw new Error(
              payload.errors?.[0]?.message ?? "Job could not be published",
            );
          setMessage("Job published successfully.");
          event.currentTarget.reset();
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Job could not be published",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Job title
        <input name="title" minLength={5} maxLength={120} required />
      </label>
      <label>
        Category
        <input name="category" minLength={2} maxLength={60} required />
      </label>
      <label>
        Description
        <textarea
          name="description"
          minLength={30}
          maxLength={10000}
          rows={7}
          required
        />
      </label>
      <label>
        Skills, comma separated
        <input name="skills" required />
      </label>
      <label>
        Budget in USD
        <input name="budget" type="number" min="1" step="0.01" required />
      </label>
      <button className="primary" disabled={busy}>
        {busy ? "Publishing…" : "Publish job"}
      </button>
      <p aria-live="polite">{message}</p>
    </form>
  );
}
