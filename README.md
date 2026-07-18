# Proofwork — Decentralized Freelance Marketplace

Proofwork combines off-chain job, proposal, dispute, and reputation workflows with program-controlled native SOL milestone escrow. It includes a Next.js frontend, Hono/GraphQL API, PostgreSQL persistence, an idempotent Solana event indexer, Wallet Standard authentication, an Anchor escrow with capped fees and resolver recovery, and CI.

## Local start

```sh
cp .env.example .env
docker compose up -d
DATABASE_URL='postgresql://marketplace:marketplace@localhost:5433/marketplace?schema=public' npm run db:migrate -- --name foundation
npm run db:seed
npm run validator
```

Run `npm run dev:api` and `npm run dev` in separate terminals. The validator command uses the installed Agave CLI and writes only to ignored `.local-ledger`. It never targets mainnet and the application never reads or stores a keypair.

## Quality gates

```sh
npm run check
npm run build
npm run program:test
npm run program:build
docker compose config --quiet
```

See `docs/demo.md` for the review flow, `docs/architecture.md` for service boundaries, `docs/security-review.md` for residual risks, and `docs/deployment.md` for localnet/devnet release gates.
