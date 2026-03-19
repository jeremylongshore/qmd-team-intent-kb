# Phase 4 After Action Review — Policy Engine, Store, Control Plane API

## Date

2026-03-18

## Scope

Phase 4 implemented three sub-phases: the policy engine (4A), SQLite persistence layer (4B), and the control plane REST API (4C). Together these establish the canonical system of record and deterministic governance evaluation.

## What Was Delivered

### Phase 4A — Policy Engine (`packages/policy-engine`)

- 6 deterministic rule evaluators: secret detection, content length, source trust, relevance score, dedup check, tenant match
- `PolicyPipeline` class with priority-sorted, short-circuiting evaluation
- Rule registry and `createRule()` factory mapping `PolicyRuleType` to evaluators
- 54 tests

### Phase 4B — Store (`packages/store`) — New Package

- SQLite persistence via `better-sqlite3` with WAL mode and foreign keys
- 5 repositories: candidate, memory, policy, audit (append-only), export-state
- Idempotent DDL schema creation, in-memory option for tests (`:memory:`)
- 38 tests

### Phase 4C — Control Plane API (`apps/api`)

- Fastify REST API with service layer pattern
- Routes: POST/GET candidates, GET/transition memories, CRUD policies, GET audit, GET health
- Zod validation on all inputs, lifecycle transition validation with audit trail
- 62 tests via Fastify `inject()`

## Architectural Decisions

### Persistence: SQLite via better-sqlite3

Single-file, zero-config, embedded database. Fast enough for team-scale data. Easy backup (copy file). WAL mode for read concurrency. DB path defaults to `~/.teamkb/data/teamkb.db`.

### `packages/store` Extraction

Both `apps/api`, `apps/curator`, and `apps/git-exporter` need repository access. Having `apps/api` own the repos would create app-to-app dependencies. A shared `packages/store` is cleaner.

### Auth Posture: Deferred

No authentication implemented. Current assumption: single-user or trusted-network deployment. Future hardening: API key auth, then role-based (admin/curator/reader) with tenant scoping.

### Repository Pattern

Prepared statements compiled once in constructor. Synchronous API matching better-sqlite3's design. JSON serialization for complex fields (author, metadata, policyEvaluations).

## Test Count

154 new tests (54 + 38 + 62). Cumulative: 523.

## Lessons Learned

- better-sqlite3's synchronous API simplifies repository code vs async alternatives
- Fastify `inject()` is excellent for API testing without HTTP overhead
- Policy engine's pure-function rule evaluators are highly testable
- `noUncheckedIndexedAccess` catches real bugs in index access patterns
