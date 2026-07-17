import Link from "next/link";
import { TransactionHistory } from "./transaction-history";

export default function TransactionsPage() {
  return (
    <main>
      <nav>
        <Link href="/" className="brand">
          PROOFWORK
        </Link>
        <div>
          <Link href="/disputes">Disputes</Link>
          <Link href="/jobs">Jobs</Link>
        </div>
      </nav>
      <header className="page-header">
        <p className="eyebrow">ON-CHAIN ACTIVITY</p>
        <h1>Follow escrow confirmations.</h1>
        <p>
          History is limited to transactions involving your authenticated
          wallet. Finalized is the strongest displayed confirmation.
        </p>
      </header>
      <TransactionHistory />
    </main>
  );
}
