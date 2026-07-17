import Link from "next/link";
import { DisputeWorkspace } from "./workspace";

export default function DisputesPage() {
  return (
    <main>
      <nav>
        <Link href="/" className="brand">
          PROOFWORK
        </Link>
        <Link href="/transactions">Transactions</Link>
      </nav>
      <header className="page-header">
        <p className="eyebrow">RECOVERY</p>
        <h1>Submit evidence without exposing custody.</h1>
        <p>
          Evidence stays content-addressed off-chain. Opening or resolving
          on-chain always requires the appropriate wallet signature.
        </p>
      </header>
      <DisputeWorkspace />
    </main>
  );
}
