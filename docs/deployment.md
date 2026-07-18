# Deployment guide

## Supported environments

Localnet is the default. Devnet is the only remote environment covered by this guide. Never deploy to mainnet from these instructions.

## Reproducible preflight

1. Install the pinned Anchor `1.0.2`, current Rust stable, Node 24, and the compatible Agave CLI.
2. Copy `.env.example` to `.env`; use separate database, session secret, RPC, and object-store credentials per environment.
3. Run `npm ci`, `npm run db:generate`, `npm run check`, `npm run build`, `npm run program:test`, and `npm run program:build`.
4. Run `docker compose config --quiet`, `npm audit --omit=dev`, and `prisma migrate status` against the target database.
5. Review the generated IDL and SBF hash. Confirm the program ID in source, `Anchor.toml`, environment, indexer, and client all match.

## Localnet

Start `npm run validator`, apply migrations, seed the demo tenant, then run API, indexer, and web in separate terminals. Use disposable local wallets only. Simulate every transaction before requesting a wallet signature.

## Devnet change procedure

The deployer supplies their own wallet through the Solana CLI; no keypair belongs in this repository or CI. Before any deployment, record the cluster, program address, executable hash, upgrade authority, expected rent/fees, database migration, and rollback owner. Obtain explicit human approval, then run Anchor deployment manually with `NO_DNA=1` and an explicit devnet provider. Deployment and any initialization transactions must be simulated and reviewed before signing.

After deployment, verify program ownership and executable data through two RPC providers, run a minimal funded escrow with negligible devnet SOL, confirm indexed events reach `FINALIZED`, and test expiry/dispute recovery. Do not reuse development resolver or fee-recipient addresses.

## Rollback and incident response

Database migrations are forward-only; restore from a verified backup into a new database if rollback is required. Pause frontend transaction preparation and the indexer during an incident, preserve logs and transaction signatures, and publish the affected program/version. Program upgrades require the same review as initial deployment. Never rotate an authority silently.
