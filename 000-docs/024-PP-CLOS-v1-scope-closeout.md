# v1 Scope Closeout

## Delivered (Phases 1–9)

### Core Platform (Phases 1–3)

- **Domain Model**: 12 Zod schemas, lifecycle state machine, 12 enum types, SearchScope defaults
- **Claude Runtime**: Session capture hooks, JSONL spool, 11-pattern secret detection with content redaction
- **qmd Adapter**: CLI wrapper, curated-only default search, tenant-isolated indexes, health checks

### Governance & Persistence (Phase 4)

- **Policy Engine**: 8 deterministic rule evaluators (secret-detection, content-length, source-trust, relevance-score, dedup-check, tenant-match, sensitivity-gate, content-sanitization), short-circuit pipeline
- **SQLite Store**: 5 repository classes, WAL mode, in-memory test support
- **Control Plane API**: Fastify 5, dependency injection, candidate intake, memory lifecycle, policy CRUD, audit trail, health check

### Workflows (Phases 5–6)

- **Curator**: Spool intake -> policy evaluation -> exact-hash dedup -> Jaccard supersession -> promote/reject, dry-run mode
- **Git Exporter**: Incremental Markdown export, YAML frontmatter, category-based directory routing, export state tracking

### Observability (Phase 7)

- **Reporting**: Memory aggregator, policy aggregator, lifecycle formatters, tenant-scoped analytics

### Security (Phase 8)

- **API Middleware**: Rate limiter (sliding window), API key auth, input sanitizer (recursive traversal)
- **Content Classifier**: Sensitivity levels, export gating
- **Policy Rules**: sensitivity-gate, content-sanitization
- **Path Safety**: Traversal and null-byte detection in common package

### Release Readiness (Phase 9)

- Documentation truth pass, version alignment (0.1.0), CI fixes, repo cleanup

## Test Coverage

- **Total tests**: 776+
- **All passing**: Yes
- **Coverage by area**: Schema (225), Policy Engine (54+), Store (38), API (62), Curator (79), Git Exporter (76), Reporting (53), Security (76), Runtime/Adapter (remaining)

## Deferred to Post-v1

| Item                              | Reason                                                          | Priority |
| --------------------------------- | --------------------------------------------------------------- | -------- |
| `apps/edge-daemon`                | Local qmd sync daemon — requires production deployment patterns | Medium   |
| `packages/repo-resolver`          | Multi-repo context resolution — not needed for single-repo use  | Low      |
| Enterprise managed settings       | Requires Claude Code enterprise API integration                 | Low      |
| Horizontal scaling (rate limiter) | In-memory rate limiting sufficient for single-instance          | Medium   |
| Web dashboard for reporting       | Reporting is code-only; dashboard requires frontend framework   | Low      |
| npm publish setup                 | No publish target exists yet                                    | Low      |
| Schema migration tooling          | Manual migrations acceptable at 0.x                             | Medium   |

## Release Posture Assessment

**Honest assessment: This is a credible 0.1.0 prerelease.**

What is solid:

- Complete governance pipeline from capture to export
- Deterministic policy evaluation (no LLM judgment in decisions)
- Comprehensive test coverage (776+ tests)
- Security hardening with real middleware
- Clean TypeScript with strict mode

What is not v1-ready:

- No production deployment tested
- Edge daemon and repo resolver are scaffolding only
- Rate limiter is in-memory (single-instance only)
- No schema migration tooling
- API contracts may still change

**Recommendation**: Ship 0.1.0 as a prerelease milestone. Target 1.0 after edge daemon implementation and production deployment validation.
