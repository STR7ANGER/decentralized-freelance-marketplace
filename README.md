# Proofwork — Decentralized Freelance Marketplace

Proofwork combines off-chain job/proposal workflows with future program-controlled Solana milestone escrow. Today’s slice includes the independently runnable Next.js frontend and Hono API, tenant-scoped PostgreSQL schema, Wallet Standard connection, signed-nonce authentication, public job discovery, authenticated job posting, local infrastructure, and CI.

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
docker compose config --quiet
```

See `docs/demo.md` for the review flow and `docs/architecture.md` for service boundaries.
