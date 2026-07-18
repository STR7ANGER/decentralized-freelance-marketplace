# Security review

Scope: Anchor escrow, wallet authentication, GraphQL/API authorization, persistence, indexer, and deployment process. This is an engineering review, not an independent audit.

## Program findings and controls

- Typed Anchor accounts validate ownership and discriminators. Every state account is bound to canonical PDA seeds and its stored bump.
- Client, freelancer, resolver, fee recipient, escrow, and milestone relationships are constrained. No instruction accepts an arbitrary CPI target.
- Initialization uses `init`, never `init_if_needed`, preventing reinitialization.
- Fund movement uses checked arithmetic, preserves rent, and rechecks `released + refunded <= funded <= total`.
- Fee basis points are immutable per escrow and capped at 1,000. Fee math and overflow cases are tested.
- Disputes require a participant signature; resolutions require the immutable resolver and exact remaining-balance awards.
- Terminal states reject normal settlement transitions. Expiry recovery can return unresolved funds only to the stored client.
- Events contain addresses, amounts, and fixed hashes—not evidence text or credentials.

## Application and infrastructure controls

- Wallet authentication uses domain/URI/cluster-bound single-use nonces, Ed25519 verification, expiration, replay prevention, hashed sessions, HttpOnly cookies, and tenant scoping.
- GraphQL mutations authenticate first and domain services independently verify roles and ownership.
- The indexer has no signer, treats RPC data as untrusted, bounds batches/log payloads, and uses idempotency keys.
- Secrets are environment-only and excluded from telemetry. Logs use fixed event and route names.
- PostgreSQL uniqueness constraints protect proposal revisions, reviews, and indexed events from duplicate writes.

## Residual risks

- The Anchor/Agave toolchain currently emits upstream cfg and post-processing syscall warnings despite successful SBF builds; resolve the compatibility warning before a production deployment.
- Program integration tests currently emphasize deterministic invariants rather than an independent external audit or a full LiteSVM transaction harness.
- Resolver availability is a liveness dependency until expiry. Production should use a reviewed multisig resolver.
- IPFS guarantees content addressing, not availability; use multiple pinning providers.
- A program upgrade authority can change behavior. Production must transfer it to a multisig or make the program immutable after audit.

## Release decision

Approved for localnet development. Devnet is permitted only after the deployment checklist passes. Mainnet is explicitly out of scope until the toolchain warning, external audit, multisig authorities, monitoring, incident response, and transaction-level adversarial suite are complete.
