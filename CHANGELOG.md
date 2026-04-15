# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `apps/api`: generated OpenAPI 3.1 spec served at `GET /openapi.json` and Swagger UI at `GET /docs`, powered by `@fastify/swagger` + `@fastify/swagger-ui`. Routes declare minimal schema metadata (tags, summary, description) for navigable documentation. The spec and docs UI are exempt from API key authentication so they stay publicly reachable. (bead `qmd-team-intent-kb-fwp`)

## [0.3.0] - 2026-03-19

### Added

- MCP server (`apps/mcp-server`) with 5 tools: `teamkb_propose`, `teamkb_import`, `teamkb_status`, `teamkb_transition`, `teamkb_sync`
- Claude Code plugin packaging: `.claude-plugin/plugin.json`, `.mcp.json`, `hooks/hooks.json`
- SessionStart hook (`scripts/bootstrap.sh`) for database initialization and qmd collection setup
- Stop hook (`scripts/flush-spool.sh`) for end-of-session spool draining
- TeamKB skill definition (`skills/teamkb/SKILL.md`) for ambient capture guidance
- 4 subagent definitions: `teamkb-curator`, `teamkb-classifier`, `teamkb-conflict-checker`, `teamkb-scout`
- Rejection feedback channel (`apps/edge-daemon/src/feedback.ts`) for governance learning
- FTS5 virtual table for full-text search with ranked results
- Schema migrations framework (`packages/store`) with `schema_migrations` table
- Intra-batch deduplication in curator pipeline
- Path traversal validation in spool writer and git exporter
- Per-agent spool files for multi-agent concurrency

### Fixed

- Node 20 compatibility using fast-glob instead of node:fs/promises glob (requires Node 22)
- Timing-safe API key comparison with `crypto.timingSafeEqual`
- Fail-closed authentication in production mode
- LIKE wildcard escaping (`%`, `_`, `\`) in SQL text search
- Shutdown handler exits with non-zero code on failure

### Security

- File permissions 0700 on `~/.teamkb/` directory
- `busy_timeout = 5000` pragma for WAL mode concurrency
- `--` argument separator for qmd CLI commands

---

## [0.2.0] - 2026-03-19

### Added

- Search API endpoint (`POST /api/search`) with freshness-aware reranking combining raw scores with exponential time decay and category boost
- Edge daemon (`apps/edge-daemon`) with full implementation: local spool watch, curation cycle, staleness sweep, index sync, PID locking, graceful shutdown
- Staleness automation — auto-deprecate active memories older than configurable `staleDays` threshold with audit trail
- Freshness scoring utilities (`packages/common`) with exponential decay, category boost weights, and generic reranking function
- SQL text search on MemoryRepository with LIKE-based query, tenant/category filters, active-only scope
- Graduated relevance scoring in policy engine: content length tiers, unique word count signal, manual/import source bonus

### Changed

- Relevance score rule now uses graduated weights: title (+0.20), content 50-200 chars (+0.10), content >200 chars (+0.20), unique words >15 (+0.10), manual/import source (+0.10)
- Upgraded Vitest to v4.1, ESLint to v10, Zod to v4, @types/node to v25
- Added `vitest.config.ts` for explicit test file discovery

### Fixed

- TypeScript project references now properly configured across all packages

---

## [0.1.0] - 2026-03-19

### Added

- API middleware stack: rate-limiter (sliding window), API key authentication, input sanitizer with recursive traversal (Phase 8, 76 tests)
- Content classifier with sensitivity-gate and content-sanitization policy rules (Phase 8)
- Export gating — git-exporter respects sensitivity classification (Phase 8)
- Path-safety utilities in common package with traversal and null-byte detection (Phase 8)
- Reporting app with lifecycle analytics: memory aggregator, policy aggregator, lifecycle formatters (Phase 7, 53 tests)
- Git exporter with incremental Markdown export, YAML frontmatter, category-based directory mapping, and idempotent writes (Phase 6, 76 tests)
- Curator engine with full promotion pipeline: spool intake, exact-hash dedup, policy evaluation, Jaccard supersession detection, dry-run mode (Phase 5, 79 tests)
- Control plane REST API with Fastify: candidate intake, memory lifecycle transitions, policy CRUD, audit trail, health check (Phase 4C, 62 tests)
- SQLite persistence layer (`packages/store`) with better-sqlite3, WAL mode, 5 repositories, in-memory testing (Phase 4B, 38 tests)
- Policy engine with 6 deterministic rule evaluators and short-circuit pipeline: secret detection, content length, source trust, relevance score, dedup check, tenant match (Phase 4A, 54 tests)
- Release workflow with dispatch trigger, tag trigger, changelog validation, and placeholder detection
- Security workflow with weekly npm audit, lockfile integrity check, and secret scanning
- Nightly workflow with full validation, dependency audit, and outdated dependency check
- Test artifact upload in CI workflow for post-run analysis
- `build` script in root package.json (`tsc -b`)
- Issue template config linking blank issues to GitHub Discussions
- Branch protection checklist doc (016-OD-OPSM)
- qmd adapter with curated-only default search, 5 collection types, and index isolation per tenant
- Real qmd CLI integration with RealQmdExecutor and health check
- Claude runtime capture layer with local JSONL spool, secret detection (11 patterns), and content redaction
- Shared utilities: Result<T, E> type, SHA-256 content hashing, TeamKB path resolution
- Shell hook templates and CLAUDE.md guidance block generators
- Core domain model with Zod schemas for MemoryCandidate, CuratedMemory, GovernancePolicy, SearchQuery/Result, and AuditEvent
- Lifecycle state machine with transition validation (active, deprecated, superseded, archived)
- Shared primitive types (UUID, SHA-256 hash, ISO datetime, Author, ContentMetadata)
- 12 enum definitions covering memory source, trust level, category, and governance actions
- SearchScope defaults to curated-only, enforcing governed search behavior
- CuratedMemory refinement requiring supersession link when lifecycle is superseded
- 225 schema tests covering valid/invalid inputs, defaults, and edge cases
- Monorepo scaffolding with pnpm workspaces (apps/, packages/, kb-export/, tests/, scripts/, examples/)
- Architecture documentation and system thesis (000-docs/001-repo-blueprint)
- Security policy with project-specific threat model covering memory integrity, MCP risk, and tenant isolation
- Contribution guidelines with commit conventions, PR expectations, and review process
- CI pipeline with lint, format check, type check, and test validation via GitHub Actions
- Gemini code review via Workload Identity Federation on pull requests
- 12-document knowledge base in 000-docs/
- Release and versioning policy following Semantic Versioning
- Beads task tracking initialization with 10 epics spanning foundation through enterprise features
