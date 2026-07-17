# Event indexer and transaction history

## Acceptance criteria

- Observe only the configured escrow program through the configured localnet or devnet RPC endpoint.
- Persist one transaction record and each Anchor event log with a `(signature, eventIndex)` idempotency key.
- Advance confirmation state without allowing a later poll to downgrade `FINALIZED` to `CONFIRMED` or `PROCESSED`.
- Record failed transactions explicitly, bound each poll to 100 signatures, and avoid logging transaction payloads.
- Return history only when the authenticated wallet appears in the transaction account list.
- Render loading, empty, failure, processed, confirmed, finalized, and failed states.

## Architecture

`services/indexer` owns RPC polling, parsing, confirmation progression, and persistence. It has no signing capability. PostgreSQL stores normalized chain observations; the authenticated GraphQL API provides the read boundary; the Next.js page renders that data. On-chain state remains authoritative.

Run `npm run dev:indexer` after setting `DATABASE_URL`, `SOLANA_RPC_URL`, and `ESCROW_PROGRAM_ID`. The first version polls recent signatures every five seconds. A production deployment should add a durable cursor, exponential backoff, RPC provider failover, and decoded event names from the committed IDL.

## Data minimization and failure behavior

The worker stores account addresses needed for participant filtering and a bounded Anchor event payload. It never stores private keys, signatures from browser signing prompts, or unbounded raw logs. RPC and parsing errors fail the current poll and are reported as a structured error without secrets; the next interval retries.
