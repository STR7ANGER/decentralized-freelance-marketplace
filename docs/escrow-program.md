# Anchor escrow account and PDA design

## Scope and asset decision

The first program escrows native SOL only. Supporting SPL Token or Token-2022 before mint-extension accounting is separately designed would widen the attack surface. The off-chain contract terms hash and participant wallet addresses become immutable initialization arguments; job text, messages, and private evidence never enter program state.

## Program-derived account

One program-owned `Escrow` PDA stores both state and escrowed lamports:

```text
Escrow PDA = find_program_address(
  ["escrow", contract_id_32_bytes, client_pubkey, freelancer_pubkey],
  program_id
)
```

Anchor derives the canonical bump and stores it. Including contract, client, and freelancer prevents PDA sharing across contracts or users. The program uses `init`, never `init_if_needed`, so an initialized escrow cannot be reinitialized. Each milestone uses `["milestone", escrow_pubkey, index_le_bytes]` and an Anchor discriminator.

## Core fields

`Escrow` stores contract ID, client, freelancer, resolver, total/planned/funded/released/refunded lamports, expiry timestamp, milestone count, next releasable index, state, and canonical bump. `Milestone` stores escrow address, sequential index, amount, due timestamp, state, and bump.

## Funding contract

Only the stored client signer funds. Funding is allowed only after milestone amounts exactly equal the contract total. A System Program CPI moves lamports into the escrow PDA. The CPI target is fixed, all arithmetic is checked, partial funding cannot exceed the total, and program state updates only if the CPI succeeds.

No transaction is assembled, signed, simulated, or submitted by the API during Tasks 13–18. The program and its pure transition/invariant tests are built locally; a future wallet flow must simulate and display recipient, amount, fee payer, and localnet/devnet before requesting approval.

## Conservation invariants

- `planned_amount == sum(milestone.amount)` and never exceeds `total_amount`.
- `released_amount + refunded_amount <= funded_amount <= total_amount`.
- Escrow spendable lamports equal `funded - released - refunded`; rent reserve is never paid out.
- Milestones release strictly by index and at most once.
- Only client approves/releases; only freelancer submits; expiry refunds only the remaining funded amount to the stored client.
- Client and freelancer addresses must differ; amounts are positive; expiry is in the future.

## Threat controls

Typed Anchor accounts enforce program ownership/discriminators. `Signer` and `has_one`/address constraints enforce authority relationships. Canonical PDA seeds block substitution, checked math blocks wraparound, direct program-owned lamport mutation avoids arbitrary CPI on release, and emitted events contain identifiers/amounts but no private terms. Adversarial runtime tests and upgrade authority policy remain part of Tasks 28–30.
