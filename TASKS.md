# Decentralized Freelance Marketplace — 30-Task Execution Plan

Complete tasks in order unless a dependency is explicitly removed. Each day has 10 active tasks; unfinished work rolls forward before later tasks begin. Keep at most 10 task checkboxes marked `[~]` (in progress) at once; use `[x]` only after verification.

## Day 1 — Foundation and first vertical slice (Tasks 1–10)

- [x] 1. Design monorepo, local validator, databases, Docker, and CI; write acceptance criteria, contracts, risks, and the smallest vertical slice.
- [x] 2. Implement monorepo, local validator, databases, Docker, and CI; keep frontend, API, domain logic, workers, and persistence in their declared boundaries.
- [x] 3. Verify monorepo, local validator, databases, Docker, and CI with tests, failure cases, telemetry, documentation, and a reviewable demo.
- [x] 4. Design wallet authentication, nonce verification, profiles, and permissions; write acceptance criteria, contracts, risks, and the smallest vertical slice.
- [x] 5. Implement wallet authentication, nonce verification, profiles, and permissions; keep frontend, API, domain logic, workers, and persistence in their declared boundaries.
- [x] 6. Verify wallet authentication, nonce verification, profiles, and permissions with tests, failure cases, telemetry, documentation, and a reviewable demo.
- [x] 7. Design job discovery, posting, filtering, and GraphQL query layer; write acceptance criteria, contracts, risks, and the smallest vertical slice.
- [x] 8. Implement job discovery, posting, filtering, and GraphQL query layer; keep frontend, API, domain logic, workers, and persistence in their declared boundaries.
- [x] 9. Verify job discovery, posting, filtering, and GraphQL query layer with tests, failure cases, telemetry, documentation, and a reviewable demo.
- [x] 10. Design proposal comparison, messaging boundary, and contract negotiation; write acceptance criteria, contracts, risks, and the smallest vertical slice.

## Day 2 — Core workflows and integrations (Tasks 11–20)

- [x] 11. Implement proposal comparison, messaging boundary, and contract negotiation; keep frontend, API, domain logic, workers, and persistence in their declared boundaries.
- [x] 12. Verify proposal comparison, messaging boundary, and contract negotiation with tests, failure cases, telemetry, documentation, and a reviewable demo.
- [x] 13. Design Rust escrow accounts, PDA design, funding, and invariant tests; write acceptance criteria, contracts, risks, and the smallest vertical slice.
- [ ] 14. Implement Rust escrow accounts, PDA design, funding, and invariant tests; keep frontend, API, domain logic, workers, and persistence in their declared boundaries.
- [ ] 15. Verify Rust escrow accounts, PDA design, funding, and invariant tests with tests, failure cases, telemetry, documentation, and a reviewable demo.
- [ ] 16. Design milestone submission, approval, release, refund, and expiry flows; write acceptance criteria, contracts, risks, and the smallest vertical slice.
- [ ] 17. Implement milestone submission, approval, release, refund, and expiry flows; keep frontend, API, domain logic, workers, and persistence in their declared boundaries.
- [ ] 18. Verify milestone submission, approval, release, refund, and expiry flows with tests, failure cases, telemetry, documentation, and a reviewable demo.
- [ ] 19. Design event indexer, confirmation tracking, and transaction history UI; write acceptance criteria, contracts, risks, and the smallest vertical slice.
- [ ] 20. Implement event indexer, confirmation tracking, and transaction history UI; keep frontend, API, domain logic, workers, and persistence in their declared boundaries.

## Day 3 — Advanced behavior and production hardening (Tasks 21–30)

- [ ] 21. Verify event indexer, confirmation tracking, and transaction history UI with tests, failure cases, telemetry, documentation, and a reviewable demo.
- [ ] 22. Design dispute evidence, resolver authorization, and recovery paths; write acceptance criteria, contracts, risks, and the smallest vertical slice.
- [ ] 23. Implement dispute evidence, resolver authorization, and recovery paths; keep frontend, API, domain logic, workers, and persistence in their declared boundaries.
- [ ] 24. Verify dispute evidence, resolver authorization, and recovery paths with tests, failure cases, telemetry, documentation, and a reviewable demo.
- [ ] 25. Design reputation, platform fees, IPFS metadata hashes, and observability; write acceptance criteria, contracts, risks, and the smallest vertical slice.
- [ ] 26. Implement reputation, platform fees, IPFS metadata hashes, and observability; keep frontend, API, domain logic, workers, and persistence in their declared boundaries.
- [ ] 27. Verify reputation, platform fees, IPFS metadata hashes, and observability with tests, failure cases, telemetry, documentation, and a reviewable demo.
- [ ] 28. Design adversarial program tests, E2E wallet flow, security review, and deployment guide; write acceptance criteria, contracts, risks, and the smallest vertical slice.
- [ ] 29. Implement adversarial program tests, E2E wallet flow, security review, and deployment guide; keep frontend, API, domain logic, workers, and persistence in their declared boundaries.
- [ ] 30. Verify adversarial program tests, E2E wallet flow, security review, and deployment guide with tests, failure cases, telemetry, documentation, and a reviewable demo.

## Task completion checklist

A task is complete only when code is formatted and typed, tests pass, migrations are reproducible, UI states are handled, authorization is enforced, logs contain no secrets, and relevant docs are updated. Track blockers beneath the task instead of silently widening scope.
