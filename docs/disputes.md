# Dispute and recovery design

## Acceptance criteria

- Only the escrow client or freelancer can open a dispute, and only while funded or active.
- Evidence is stored off-chain under a content-addressed CID; the API validates and records its SHA-256 digest, while the program stores only the fixed 32-byte digest.
- Only the resolver fixed during escrow initialization can settle a dispute.
- Settlement divides the remaining balance between the named client and freelancer, uses checked arithmetic, preserves rent, and cannot be replayed.
- The backend never owns a resolver key and never signs a settlement transaction.

## Contract

`open_dispute(evidence_hash)` moves the escrow to `Disputed` and emits the digest. `resolve_dispute(client_amount, freelancer_amount, resolution_hash)` requires both awards to sum exactly to the remaining escrow balance. Destinations are constrained to the stored participant addresses. A resolution is terminal and emits only hashes and amounts.

The API accepts an IPFS CID, a lowercase 64-character SHA-256 digest, and a bounded private note. The note is not emitted on-chain or included in telemetry. Resolver authorization is checked independently in the API and the Anchor account constraints.

## Recovery and risk

If the designated resolver is unavailable, funds remain governed by the existing expiry refund path until a future multisig/governance upgrade is reviewed. Resolver rotation and arbitrary recovery authorities are intentionally excluded because either would weaken the immutable participant agreement.
