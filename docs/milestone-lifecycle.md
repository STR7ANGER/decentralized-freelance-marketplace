# Milestone lifecycle

## Acceptance criteria

- The client creates an escrow PDA for one canonical contract, then adds milestones in ascending index order.
- Milestone amounts must be positive and sum exactly to the contract total before funding can complete.
- Only the client funds, approves, and releases; only the named freelancer submits work.
- A release pays only the approved next milestone and can never spend more than the funded balance.
- After expiry, anyone may trigger the remaining-balance refund, but funds always return to the named client.
- Every state transition emits a compact event for the off-chain indexer.

## Accounts and boundaries

The escrow PDA uses `escrow`, the 32-byte contract ID, the client address, and the freelancer address as seeds. Each milestone PDA uses `milestone`, the escrow address, and its little-endian `u16` index. The program stores native SOL in the program-owned escrow account while retaining its rent-exempt reserve.

The web application prepares intent and displays transaction state; it never stores signing keys. The API stores the negotiated contract and its canonical terms hash. The Rust program alone authorizes fund movement. The indexer observes emitted events and must not be trusted as a source of authorization.

## State flow

`Draft -> Funded -> Active -> Completed` is the successful path. The freelancer changes the next milestone from `Pending` to `Submitted`; the client changes it to `Approved`, then releases exactly that milestone amount. A funded or active escrow may instead become `Expired` once its deadline passes and the remaining balance is returned.

## Safety properties and risks

- All additions and subtractions use checked arithmetic.
- `released + refunded <= funded <= total` must hold after every fund movement.
- Account constraints bind signers, escrow participants, milestones, bumps, and PDA seeds.
- Releases preserve the escrow account's rent reserve.
- Native SOL is the initial asset. SPL Token support requires token-account ownership, mint, and authority constraints and is intentionally deferred.
- Expiry is based on the cluster clock. Clients should display it as an estimate and wait for finalized history before treating a transaction as irreversible.

## Local verification

Run `npm run program:test` for deterministic invariant tests. Run `npm run program:build` to compile the Anchor program for Solana SBF. The source uses a fixed public development program ID; local generated deployment keypairs are ignored and must not be committed.
