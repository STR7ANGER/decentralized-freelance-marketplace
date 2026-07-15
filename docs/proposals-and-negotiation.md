# Proposal comparison, messaging boundary, and contract negotiation design

Task 10 fixes the boundary and invariants; implementation begins in Task 11.

## Domain contracts

A freelancer may maintain one versioned proposal per job. A proposal contains a bounded cover letter, total minor-unit amount, currency matching the job, delivery days, and an ordered milestone draft. Clients compare normalized price, delivery, milestone distribution, verified completion summary, and submission timestamp—never an opaque AI rank.

Accepting a proposal creates exactly one `NEGOTIATING` contract through an idempotent command. Each revision carries an expected version; stale writes return `VERSION_CONFLICT`. Agreement requires both wallet identities to sign the same canonical terms hash before the contract becomes `AGREED`. Escrow funding remains a later, separately reviewed on-chain transaction.

## Messaging boundary

Messages are off-chain, contract/job scoped, append-only, and visible only to participants and explicitly authorized resolvers. PostgreSQL stores ordering and membership truth; a future MongoDB adapter may hold bounded rich bodies/attachments with a PostgreSQL content hash. Messages cannot mutate proposal or contract state and content is treated as untrusted input.

## State and authorization

```text
SUBMITTED → SHORTLISTED → ACCEPTED
     ├───────────────→ REJECTED
     └───────────────→ WITHDRAWN

NEGOTIATING → AGREED → ACTIVE → COMPLETED
      └──────────────→ CANCELLED
```

- Only a freelancer can create/revise/withdraw their proposal.
- Only the job’s client can shortlist, reject, or initiate acceptance.
- Both parties must agree to the same version and terms hash.
- Job, proposal, profile, contract, and every milestone must share one tenant.
- Accepted proposal amount must equal the checked sum of milestone amounts.

## Failure and observability design

Idempotency keys cover submit, accept, and agreement commands. Stable errors include `JOB_CLOSED`, `PROPOSAL_EXISTS`, `CURRENCY_MISMATCH`, `FORBIDDEN`, `VERSION_CONFLICT`, and `TERMS_MISMATCH`. Metrics expose transition counts and latency with bounded state labels; logs contain request IDs and entity IDs but no message bodies or terms.

## Risks before implementation

Race tests must cover two accept attempts, stale revision, job closure during submission, duplicated idempotency keys, and participant removal. Private attachment scanning/retention, message abuse reporting, notification delivery, and terms-hash canonicalization require dedicated adapters and tests.
