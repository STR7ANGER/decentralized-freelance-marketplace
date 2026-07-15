import Link from "next/link";
import { NewJobForm } from "./new-job-form";

export default function NewJobPage() {
  return (
    <main>
      <nav>
        <Link href="/" className="brand">
          PROOFWORK
        </Link>
        <Link href="/jobs">Browse jobs</Link>
      </nav>
      <header className="page-header">
        <p className="eyebrow">CLIENT WORKSPACE</p>
        <h1>Describe the outcome before funding it.</h1>
      </header>
      <NewJobForm />
    </main>
  );
}
