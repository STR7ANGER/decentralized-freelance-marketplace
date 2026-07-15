"use client";

import { useEffect, useState } from "react";

type Job = {
  id: string;
  clientName: string;
  title: string;
  description: string;
  category: string;
  skills: string[];
  budgetMinor: string;
  currency: string;
};
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const query = `query Jobs($tenantSlug:String!,$filter:JobFilter){jobs(tenantSlug:$tenantSlug,filter:$filter){jobs{id clientName title description category skills budgetMinor currency} nextCursor}}`;
const saveMutation = `mutation SaveSearch($input:SaveSearchInput!){saveSearch(input:$input){id name search}}`;
export function JobDiscovery() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [search, setSearch] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [savedName, setSavedName] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setState("loading");
      fetch(`${apiUrl}/graphql`, {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query,
          variables: {
            tenantSlug: "demo",
            filter: { search: search || undefined, limit: 20 },
          },
        }),
      })
        .then((response) => response.json())
        .then((payload) => {
          if (!payload.data) throw new Error();
          setJobs(payload.data.jobs.jobs);
          setState("ready");
        })
        .catch((error) => {
          if (error.name !== "AbortError") setState("error");
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search]);
  return (
    <section>
      <label className="search">
        <span>Search title, description, or exact skill</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Try Rust, design systems, analytics…"
        />
      </label>
      <form
        className="save-search"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaveStatus("Saving…");
          try {
            const response = await fetch(`${apiUrl}/graphql`, {
              method: "POST",
              credentials: "include",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                query: saveMutation,
                variables: {
                  input: { name: savedName, search: search || undefined },
                },
              }),
            });
            const payload = await response.json();
            if (!payload.data) throw new Error("Sign in to save this search.");
            setSaveStatus(`Saved “${payload.data.saveSearch.name}”.`);
          } catch (error) {
            setSaveStatus(
              error instanceof Error
                ? error.message
                : "Search could not be saved.",
            );
          }
        }}
      >
        <label>
          <span>Saved search name</span>
          <input
            value={savedName}
            minLength={2}
            maxLength={60}
            onChange={(event) => setSavedName(event.target.value)}
            placeholder="Rust opportunities"
            required
          />
        </label>
        <button type="submit" className="secondary">
          Save current search
        </button>
        <p aria-live="polite">{saveStatus}</p>
      </form>
      {state === "loading" ? (
        <p className="notice" aria-live="polite">
          Finding published jobs…
        </p>
      ) : state === "error" ? (
        <p className="notice error" role="alert">
          Jobs could not be loaded. Retry in a moment.
        </p>
      ) : jobs.length === 0 ? (
        <p className="notice">No matching jobs yet.</p>
      ) : (
        <div className="job-list">
          {jobs.map((job) => (
            <article key={job.id}>
              <div>
                <span className="pill">{job.category}</span>
                <h2>{job.title}</h2>
                <p>{job.description}</p>
                <small>Posted by {job.clientName}</small>
              </div>
              <div className="job-meta">
                <strong>
                  {new Intl.NumberFormat("en", {
                    style: "currency",
                    currency: job.currency,
                  }).format(Number(job.budgetMinor) / 100)}
                </strong>
                <div>
                  {job.skills.map((skill) => (
                    <span key={skill}>{skill}</span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
