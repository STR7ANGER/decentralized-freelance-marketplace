import Link from "next/link";
import { JobDiscovery } from "./job-discovery";

export default function JobsPage() {
  return (
    <main>
      <nav>
        <Link href="/" className="brand">
          PROOFWORK
        </Link>
        <Link href="/jobs/new">Post a job</Link>
      </nav>
      <header className="page-header">
        <p className="eyebrow">OPEN OPPORTUNITIES</p>
        <h1>Find work with terms you can inspect.</h1>
        <p>
          Published opportunities only. Filters remain tenant-scoped and budgets
          use integer minor units.
        </p>
      </header>
      <JobDiscovery />
    </main>
  );
}
