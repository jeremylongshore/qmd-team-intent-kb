# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
