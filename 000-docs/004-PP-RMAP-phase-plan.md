# Phase Plan

## Overview

The project is implemented in sequential phases, each building on the previous. Dependencies between phases are explicit. Each phase delivers testable, functional increments. The plan is designed so that early phases establish the foundation (schemas, adapters, policies) and later phases compose those building blocks into complete workflows.

---

## Phase 0 — Foundation (COMPLETE)

**Status**: COMPLETE

**Scope**: Monorepo scaffolding, standards, CI, documentation, security, and contribution guidelines. No runtime features.

**Deliverables**:

- pnpm workspace configuration with all app and package directories scaffolded.
- TypeScript 5.x configuration with strict mode.
- ESLint 9 flat config and Prettier configuration.
- Vitest test runner configuration.
- GitHub Actions CI pipeline (`pnpm validate` gate).
- Gemini code review integration via WIF.
- CLAUDE.md, README.md, CONTRIBUTING.md, SECURITY.md, CODE_OF_CONDUCT.md.
- LICENSE (Intent Solutions Proprietary).
- Keep a Changelog initialized.
- Beads epics and task tracking initialized.
- 000-docs/ documentation directory.
- .gitignore, .nvmrc, .editorconfig.
- GitHub Dependabot configuration.
- CODEOWNERS file.

**Dependencies**: None.

---

## Phase 1 — Core Schema and Domain Model

**Status**: NOT STARTED

**Scope**: Define the complete domain model as Zod schemas with derived TypeScript types. This phase establishes the data contracts that all other packages and apps depend on.

**Deliverables**:

- **MemoryCandidate schema**: Raw memory proposal from a Claude Code session. Fields include source session ID, content, metadata (file paths, language, project context), capture timestamp, pre-policy flags (e.g., potential secret detected), and tenant identifiers.
- **CuratedMemory schema**: Promoted memory that has passed governance. Extends candidate data with lifecycle state, promotion timestamp, policy evaluation record, deduplication hash, supersession links, and curator metadata.
- **MemoryLifecycle schema**: State machine definition for memory status transitions (active, deprecated, superseded, archived). Includes transition rules, allowed transitions, and transition metadata requirements.
- **GovernancePolicy schema**: Configurable rule definitions. Each rule has a type (secret detection, dedup threshold, relevance score, tenant isolation), parameters, priority, and enabled/disabled flag.
- **SearchQuery schema**: Structured search request with query text, scope (curated-only default, optional inbox/archive), tenant filter, date range, content type filter, and pagination.
- **SearchResult schema**: Search response with matched memories, relevance scores, highlight snippets, total count, and pagination metadata.
- Unit tests for all schema validation (valid inputs, invalid inputs, edge cases, coercion behavior).
- Exported TypeScript types derived from Zod schemas (`z.infer<>`).

**Dependencies**: Phase 0 (monorepo scaffolding and test infrastructure).

---

## Phase 2 — Claude Runtime Capture

**Status**: NOT STARTED

**Scope**: Implement the capture layer that intercepts memory proposals from Claude Code sessions and spools them as structured candidates.

**Deliverables**:

- Claude Code session hook integration mechanism (event-based capture).
- Memory candidate extraction from session events (structured parsing of proposals).
- Local spool (inbox) implementation for raw candidates (file-based or lightweight store).
- Pre-policy secret detection filter that scans candidates before they enter the governance pipeline. Patterns: environment variable values, JWT tokens, API keys (common prefixes), connection strings, PEM-encoded private keys.
- Candidate metadata enrichment: source file paths, project context (from repo-resolver), session ID, capture timestamp.
- Unit tests for candidate extraction, secret detection patterns, and spool operations.

**Dependencies**: Phase 1 (MemoryCandidate schema).

---

## Phase 3 — qmd Adapter and Local Edge Index

**Status**: NOT STARTED

**Scope**: Wrap qmd CLI for programmatic TypeScript access. Establish the search interface with curated-only default semantics.

**Deliverables**:

- qmd CLI wrapper with typed inputs/outputs.
- Index lifecycle management: create index, update index, delete index, list indexes.
- Search interface: query execution, result parsing, relevance score extraction.
- Curated-only default search scope (inbox and archive excluded unless explicitly requested).
- Bulk indexing support for initial population and re-indexing.
- Health check utilities: qmd availability, index integrity verification.
- Unit tests for CLI wrapper, search scope enforcement, and result parsing.
- Integration tests with a real qmd instance (gated on qmd availability).

**Dependencies**: Phase 1 (SearchQuery, SearchResult schemas).

---

## Phase 4 — Policy Engine

**Status**: NOT STARTED

**Scope**: Implement the deterministic governance rule evaluation pipeline. No LLM involvement — all decisions are code.

**Deliverables**:

- Rule interface definition: each rule accepts a MemoryCandidate and returns a typed evaluation result (pass, fail, flag, with reason and confidence).
- Built-in rule implementations:
  - **Secret detection**: Regex-based scanning for API keys, tokens, passwords, private keys, connection strings. Configurable pattern library.
  - **Deduplication scoring**: Content similarity comparison against existing curated memories. Configurable similarity threshold.
  - **Relevance evaluation**: Deterministic scoring based on content length, metadata completeness, source context quality, and configurable weighting.
  - **Tenant isolation**: Validates that candidate tenant identifiers match expected project/team boundaries.
- Rule composition pipeline: ordered evaluation of multiple rules with short-circuit on critical failures (e.g., secret detected).
- Policy configuration: rules loaded from configuration with enable/disable, parameter overrides, and priority ordering.
- Evaluation logging: every rule evaluation recorded with input, output, rule ID, and timestamp.
- Unit tests for each rule type, composition pipeline, and configuration loading.

**Dependencies**: Phase 1 (MemoryCandidate, GovernancePolicy schemas).

---

## Phase 5 — Control Plane API

**Status**: NOT STARTED

**Scope**: Fastify REST API serving as the central authority for memory operations, search delegation, and governance administration.

**Deliverables**:

- Fastify application scaffolding with TypeScript, structured logging, and error handling.
- **Memory CRUD endpoints**: Create, read, update, delete curated memories. Input validation via Zod schemas.
- **Search endpoint**: Accepts SearchQuery, delegates to qmd adapter, returns SearchResult. Enforces curated-only default.
- **Governance endpoints**: CRUD for governance policies/rules. Enable/disable rules. View evaluation history.
- **Authentication**: API key or token-based authentication for team access control.
- **Authorization**: Role-based access (admin, curator, reader) with tenant-scoped permissions.
- **Health check endpoint**: Application health, qmd connectivity, storage connectivity.
- OpenAPI/Swagger documentation generated from route schemas.
- Integration tests for all endpoints (HTTP-level testing with supertest or equivalent).

**Dependencies**: Phase 1 (all schemas), Phase 3 (qmd adapter for search delegation), Phase 4 (policy engine for governance endpoints).

---

## Phase 6 — Curator Engine

**Status**: NOT STARTED

**Scope**: The promotion pipeline that moves memory candidates from inbox through governance to curated status.

**Deliverables**:

- **Intake processor**: Reads candidates from the inbox spool (batch or event-driven).
- **Policy evaluation integration**: Submits candidates to the policy engine and handles pass/fail/flag results.
- **Deduplication**: Compares passing candidates against existing curated memories using similarity scoring. Configurable thresholds for "duplicate" vs. "related" vs. "novel."
- **Supersession detection**: Identifies when a new candidate updates, corrects, or replaces an existing curated memory. Creates supersession links (old → new).
- **Lifecycle assignment**: Promotes passing, non-duplicate candidates to active status. Marks superseded memories accordingly. Records all transitions.
- **Rejection handling**: Candidates that fail policy or are flagged are moved to a rejected/review queue with reasons attached.
- **Batch processing**: Efficient processing of multiple candidates per run.
- Unit tests for deduplication logic, supersession detection, and lifecycle transitions.
- Integration tests for the full promotion pipeline.

**Dependencies**: Phase 1 (schemas), Phase 4 (policy engine), Phase 5 (control plane API for storage).

---

## Phase 7 — Git Export Mirror

**Status**: NOT STARTED

**Scope**: Publish curated knowledge to configurable git repositories as structured Markdown files.

**Deliverables**:

- **Export engine**: Reads curated memories from canonical store, formats as Markdown + YAML frontmatter.
- **Incremental export**: Tracks last export state per target repository. Only exports memories that changed since last run.
- **Frontmatter schema**: Standardized YAML frontmatter including memory ID, lifecycle state, creation date, last modified, tags, supersession links, and provenance.
- **Target configuration**: Support multiple git repositories as export targets. Per-target filtering by tenant, tag, or content type.
- **Git operations**: Clone/pull target repo, write/update/delete files, commit with structured message, push.
- **Conflict handling**: If target repo has been manually edited, detect conflicts and log warnings (canonical store always wins).
- Unit tests for Markdown formatting, frontmatter generation, and incremental change detection.
- Integration tests with a local git repository.

**Dependencies**: Phase 6 (curator produces curated memories to export).

---

## Phase 8 — Edge Daemon

**Status**: NOT STARTED

**Scope**: Background daemon that syncs canonical store to local qmd indexes on developer machines.

**Deliverables**:

- **Sync engine**: Polls or subscribes to canonical store for changes. Determines delta since last sync.
- **Incremental indexing**: Updates local qmd index with only changed memories (new, updated, deleted).
- **Per-project isolation**: Maintains separate qmd indexes per project/tenant. Never cross-pollinates indexes.
- **Conflict resolution**: Handles concurrent edits gracefully. Canonical store always wins conflicts.
- **Daemon lifecycle**: Start, stop, status, health check. Configurable sync interval.
- **Offline resilience**: Queues sync operations when canonical store is unreachable. Replays on reconnection.
- Unit tests for delta calculation, conflict resolution, and index isolation.
- Integration tests for sync operations with qmd adapter.

**Dependencies**: Phase 3 (qmd adapter), Phase 5 (control plane API as canonical store).

---

## Phase 9 — Reporting and Analytics

**Status**: NOT STARTED

**Scope**: Analytics, audit trails, and knowledge health dashboards.

**Deliverables**:

- **Memory lifecycle analytics**: Promotion rate (candidates → curated), deprecation velocity, supersession chain length, archive rate.
- **Search usage metrics**: Query volume over time, result click-through rate, zero-result query rate, most/least searched topics.
- **Governance audit trail**: Queryable log of all memory operations (promotion, demotion, supersession, deletion) with actor, timestamp, and reason.
- **Team knowledge health dashboards**: Coverage metrics (topics with/without curated knowledge), staleness indicators (age of active memories), duplication ratios, tenant-level summaries.
- **Export formats**: JSON API responses, CSV export for external analysis.
- Integration with control plane API for data access.
- Unit tests for metric calculations and aggregation logic.

**Dependencies**: Phase 5 (control plane API), Phase 6 (curator operations to report on).

---

## Phase 10 — Security Hardening and Enterprise Controls

**Status**: NOT STARTED

**Scope**: Enterprise-grade security, compliance, and operational controls.

**Deliverables**:

- **Enterprise managed settings support**: Respect organization-level Claude Code managed settings. Integrate with enterprise policy sources.
- **MCP trust boundaries**: Tag and track memory provenance when sourced from MCP server context. Apply differential trust levels to MCP-sourced vs. direct-session memories.
- **Plugin/hook policy enforcement**: Sandbox hook execution from memory operations. Prevent third-party Claude Code plugins from bypassing governance.
- **Signed releases**: Sign build artifacts and release packages. Verify signatures on deployment.
- **Reproducible builds**: Ensure build artifacts are deterministic and verifiable.
- **Retention policies**: Configurable retention periods per tenant, content type, or lifecycle state. Automated purge with audit logging.
- **Compliance controls**: Data residency configuration, export restrictions, PII detection and handling.
- **Penetration testing**: Formal security review of API endpoints, authentication, and authorization.
- Security documentation and runbooks.

**Dependencies**: All previous phases (this phase hardens the complete system).

---

## Phase Dependency Graph

```
Phase 0 (Foundation) ─── COMPLETE
    │
    ▼
Phase 1 (Schema)
    │
    ├───────────┬───────────┐
    ▼           ▼           ▼
Phase 2      Phase 3     Phase 4
(Capture)    (qmd)       (Policy)
    │           │           │
    │           ├───────────┤
    │           ▼           │
    │        Phase 5 ◄──────┘
    │        (API)
    │           │
    │           ├───────────┐
    │           ▼           ▼
    │        Phase 6     Phase 8
    │        (Curator)   (Daemon)
    │           │
    │           ├───────────┐
    │           ▼           ▼
    │        Phase 7     Phase 9
    │        (Git Export)(Reporting)
    │
    └───────────────────────┐
                            ▼
                        Phase 10
                        (Security)
```
