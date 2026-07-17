import Link from "next/link";
import { ProposalWorkspace } from "./proposal-workspace";

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main>
      <nav>
        <Link href="/" className="brand">
          PROOFWORK
        </Link>
        <Link href="/jobs">Browse jobs</Link>
      </nav>
      <header className="page-header">
        <p className="eyebrow">TERMS WORKSPACE</p>
        <h1>Compare the agreement, not a mystery score.</h1>
        <p>
          Proposal totals must equal their milestone sum. Revisions use
          optimistic versions, and contract agreement signs one canonical terms
          hash without funding escrow.
        </p>
      </header>
      <ProposalWorkspace jobId={id} />
    </main>
  );
}
