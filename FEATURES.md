# Decentralized Freelance Marketplace — Features and Requirements

## Product promise

Let clients and freelancers manage jobs, proposals, milestone escrow, disputes, and reputation with safe on-chain settlement.

## Functional scope

1. **Wallet authentication and profile onboarding** — deliver the complete UI/API/domain flow, validation, authorization, persistence, and observable failure states.
2. **Job posting, filtering, and saved searches** — deliver the complete UI/API/domain flow, validation, authorization, persistence, and observable failure states.
3. **Proposal submission and comparison** — deliver the complete UI/API/domain flow, validation, authorization, persistence, and observable failure states.
4. **Milestone contract negotiation** — deliver the complete UI/API/domain flow, validation, authorization, persistence, and observable failure states.
5. **Program-controlled escrow funding and release** — deliver the complete UI/API/domain flow, validation, authorization, persistence, and observable failure states.
6. **Dispute evidence and resolution workflow** — deliver the complete UI/API/domain flow, validation, authorization, persistence, and observable failure states.
7. **On-chain event indexing and transaction history** — deliver the complete UI/API/domain flow, validation, authorization, persistence, and observable failure states.
8. **Reputation and verified completion history** — deliver the complete UI/API/domain flow, validation, authorization, persistence, and observable failure states.
9. **Private file/proof metadata with content hashes** — deliver the complete UI/API/domain flow, validation, authorization, persistence, and observable failure states.
10. **Fees, refunds, expiry, and emergency recovery rules** — deliver the complete UI/API/domain flow, validation, authorization, persistence, and observable failure states.

## User surfaces

- **Primary application:** responsive Next.js interface using shadcn/ui, accessible forms, empty/loading/error states, and optimistic updates only when rollback is safe.
- **Operations/admin:** tenant configuration, audit history, job/event inspection, replay or recovery controls, and usage visibility.
- **API consumers:** versioned REST/GraphQL contracts, generated TypeScript client, examples, pagination, rate-limit headers, and stable error codes.
- **Background processing:** visible progress, retries, cancellation where meaningful, and support-safe correlation IDs.

## Data and security requirements

- Core records: UserProfile, Wallet, Job, Proposal, Contract, Milestone, Escrow, Evidence, Dispute, Review, ChainEvent.
- Tenant-owned tables include `tenantId`/organization ownership, indexed filters, and isolation tests.
- Encrypt sensitive values, hash tokens/keys, redact logs, and apply least-privilege authorization.
- Validate all external payloads with shared schemas; quarantine untrusted files and verify webhook signatures.
- Define retention, export, and deletion behavior. Audit privileged operations and irreversible transitions.
- Backups, migration rollback, seed fixtures, and recovery procedures must be documented.

## Quality targets

- No known critical/high security findings in the scoped threat review.
- Critical command paths are idempotent and covered by integration tests.
- p95 interactive API target: under 500 ms excluding explicitly asynchronous work.
- UI meets practical WCAG 2.1 AA checks for keyboard use, labels, focus, contrast, and errors.
- Health checks, structured logs, metrics, traces, dashboards, and actionable alerts exist.
- Local development runs through Docker Compose without requiring production credentials.

## Out of scope for the first complete version

- Premature microservice decomposition, multi-region active-active deployment, custom cryptography, and unsupported provider-specific behavior.
- Native mobile apps; the responsive web app and API come first.
- Machine-learning claims without measurable evaluation data and a deterministic fallback.

