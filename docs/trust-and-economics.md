# Reputation, fees, metadata, and observability

Platform fees are immutable per escrow, capped at 1,000 basis points, calculated with checked integer arithmetic, and paid only when a milestone releases. The event exposes gross milestone amount and fee; the conservation invariant treats both freelancer proceeds and the fee as released value.

Reputation is allowed only between counterparties of a completed contract. Each participant can submit one 1–5 rating per contract. Free-form review content belongs in content-addressed storage; PostgreSQL stores its SHA-256 digest and optional IPFS CID, preventing later content substitution without putting personal content on-chain.

Application telemetry uses fixed event names and aggregate values. It excludes notes, evidence, wallet signatures, session tokens, RPC payloads, and CIDs. HTTP logs normalize authentication and GraphQL paths to prevent identifiers becoming high-cardinality labels. Health responses expose service and cluster only.

Risks: reputation remains vulnerable to colluding counterparties and Sybil identities; displaying contract count alongside rating is required. IPFS availability is independent of integrity and should use redundant pinning. Fee-recipient governance and fee changes require new escrows rather than mutating existing agreements.
