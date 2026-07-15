import Link from "next/link";
import { WalletAccess } from "./wallet-access";

export default function HomePage() {
  return (
    <main>
      <nav>
        <Link href="/" className="brand">
          PROOFWORK
        </Link>
        <div>
          <Link href="/jobs">Find work</Link>
          <Link href="/jobs/new">Post a job</Link>
        </div>
      </nav>
      <section className="hero">
        <p className="eyebrow">LOCALNET-FIRST • WALLET STANDARD</p>
        <h1>
          Work agreed clearly.
          <br />
          Funds released fairly.
        </h1>
        <p className="lede">
          A freelance marketplace built around reviewed milestones,
          program-controlled escrow, and verifiable completion history.
        </p>
        <div className="actions">
          <Link className="primary" href="/jobs">
            Explore jobs
          </Link>
          <Link className="secondary" href="/jobs/new">
            Hire talent
          </Link>
        </div>
      </section>
      <section className="trust-grid" aria-label="Marketplace principles">
        <article>
          <span>01</span>
          <h2>Negotiate milestones</h2>
          <p>
            Compare scope, price, delivery, and milestone terms before either
            side commits.
          </p>
        </article>
        <article>
          <span>02</span>
          <h2>Fund transparent escrow</h2>
          <p>
            Future on-chain instructions default to localnet, simulation,
            explicit review, and wallet-held keys.
          </p>
        </article>
        <article>
          <span>03</span>
          <h2>Build portable proof</h2>
          <p>
            Completed contracts become a verifiable work history without
            exposing private evidence.
          </p>
        </article>
      </section>
      <WalletAccess />
    </main>
  );
}
