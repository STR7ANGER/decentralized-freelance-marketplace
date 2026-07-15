# Job posting and discovery

## GraphQL contract

`jobs(tenantSlug, filter)` is a public composed read with search, category, budget range, cursor, and bounded page size. It returns published jobs only. `createJob(input)` is an authenticated mutation limited to client/admin roles.

Search and mutation validation share versioned Zod contracts. Budget amounts are positive integer minor units; currencies normalize to uppercase; skills normalize to a unique lowercase set. Creation writes an audit event in the same application flow and telemetry contains counts/flags, never descriptions.

## Acceptance criteria

- Drafts and jobs from another tenant never appear in discovery.
- Freelancer sessions cannot create jobs.
- Title, description, skill count, currency, budget, and pagination limits fail before persistence.
- UI exposes loading, empty, provider-error, success, and validation states with keyboard-labelled fields.
- PostgreSQL indexes support tenant/status chronological discovery and tenant/category/budget filters.

## Smallest demo

Seed the `demo` tenant, authenticate a client wallet, publish a job, then open `/jobs` and search one normalized skill. A second tenant or freelancer role must not gain command access.
