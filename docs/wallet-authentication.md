# Wallet authentication, profiles, and permissions

## Contract

1. `POST /v1/auth/challenge` accepts a Solana address and tenant slug.
2. The API validates the address and returns a canonical, five-minute localnet/devnet message. It stores only SHA-256 hashes of its nonce and full message.
3. The Wallet Standard adapter signs message bytes inside the wallet. No transaction is created.
4. `POST /v1/auth/verify` validates challenge identity, tenant, expiry, exact message hash, Ed25519 signature, and atomic nonce consumption.
5. The API creates/reuses a profile and wallet, stores only a hashed random session token, audits success, and sets an HttpOnly SameSite cookie.

Failures use stable codes: `INVALID_WALLET`, `TENANT_NOT_FOUND`, `INVALID_CHALLENGE`, `INVALID_SIGNATURE`, and `UNAUTHENTICATED`. Authentication errors intentionally avoid detailed cryptographic diagnostics.

## Permissions

`CLIENT` can publish jobs. `FREELANCER` can browse now and will submit proposals later. `RESOLVER` and `ADMIN` cannot be self-selected during onboarding. Every command checks both session identity and tenant ownership at its application boundary.

## Security properties and gaps

- Challenge consumption is a conditional database update, preventing two successful replays.
- Wallet addresses, signatures, nonces, messages, session tokens, and descriptions are excluded from normal telemetry.
- Existing wallets cannot silently move between tenants.
- Production must set Secure cookies behind TLS and should add origin/CSRF enforcement, session inventory, rate limits, and resolver provisioning before public access.
