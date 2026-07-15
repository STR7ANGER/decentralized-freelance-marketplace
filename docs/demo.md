# Day 1 reviewable demo

1. Start Docker dependencies, migrate/seed PostgreSQL, and start the local validator, API, and web app.
2. Open `/` and confirm wallet discovery identifies installed Wallet Standard wallets.
3. Connect a disposable localnet wallet and select “Verify wallet.” Review the message: it names localnet and states no transaction or movement of funds.
4. Visit `/jobs/new` as a client profile and publish a synthetic job. Confirm invalid/unauthenticated attempts return a stable error.
5. Visit `/jobs`, search by a skill, and observe published-only results plus loading/empty/failure UI.
6. Run `npm run check`, `npm run build`, and `docker compose config --quiet`.

No transaction is signed or sent in Tasks 1–10.
