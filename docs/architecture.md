# Foundation architecture and acceptance

## Smallest vertical slice

A visitor can browse published jobs for the demo tenant. A Wallet Standard wallet can request and sign a localnet nonce to create an HttpOnly session. An authenticated client can publish a job, while a freelancer is denied that command. No authentication action submits a transaction.

```text
Next.js browser ── REST auth / GraphQL jobs ── Hono API
                                                   │
                    PostgreSQL (truth) ─────────────┤
                    MongoDB (future documents) ─────┤
                    Redis (future queues/limits) ───┤
                    MinIO (future private evidence) ┘

Wallet Standard holds keys; local Agave RPC is reserved for simulated/on-chain work.
```

## Boundaries

- `apps/web` owns accessible presentation, Wallet Standard connection, browser state, and API calls. It imports shared schemas but no API or Prisma code.
- `apps/api` owns validation, authentication, authorization, orchestration, GraphQL/REST transport, and repository ports.
- PostgreSQL is transactional truth. All tenant-owned queries require `tenantId`.
- MongoDB and MinIO are not used merely because they exist; later evidence/event document adapters must justify their data shape.
- The Solana program will own only escrow invariants. Jobs, proposals, messages, private evidence, and search remain off-chain.

## Foundation acceptance

- Missing secrets, an unsupported cluster, or malformed URLs stop the API before listening.
- Local configuration permits only `localnet` or `devnet`; mainnet requires a future explicit security decision.
- Docker services have health checks and persistent volumes; `docker compose config` validates cleanly.
- The health response contains no database URL, secrets, wallet address, or raw provider error.
- CI installs from the lockfile, generates Prisma, formats/lints, type-checks, tests, builds, and validates Compose.
- No private key, seed phrase, generated keypair, or ledger data is committed.

## Risks and controls

| Risk | Control in this slice |
| --- | --- |
| Cross-tenant access | `tenantId` columns/indexes and application repository filters |
| Wallet replay | Hashed, expiring, atomic single-use nonce challenge |
| Custody confusion | Sign-in message explicitly states no transaction or fund movement |
| Financial precision | All budgets use `BigInt` minor units and serialize as strings |
| Untrusted chain/wallet data | Address validation, Ed25519 verification, bounded schemas, no log payloads |
| Premature chain coupling | Hexagonal ports and off-chain domain truth until escrow instructions exist |
