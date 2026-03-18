# Architecture Overview

## System Context

The system operates as a pipeline that transforms ephemeral Claude Code session knowledge into governed, curated, searchable team memory.

```
Claude Code Sessions
        │
        ▼
  Memory Candidates (raw proposals)
        │
        ▼
  Policy Engine (deterministic evaluation)
        │
        ▼
  Curator (promotion, dedupe, supersession)
        │
        ▼
  Canonical Store (source of truth)
        │
        ├──────────────────┐
        ▼                  ▼
  qmd Index            Git Export
  (edge retrieval)     (distribution mirror)
```

## Key Architectural Boundaries

### 1. Capture Boundary

Claude Code proposes memory during sessions. The Claude Runtime package (`packages/claude-runtime`) intercepts these proposals, applies pre-policy secret filtering, and spools raw candidates to a local inbox. The capture boundary ensures that all memory enters the system through a single, auditable intake point. No memory bypasses the spool.

### 2. Policy Boundary

Deterministic code — never LLM judgment — evaluates candidates against governance rules. The Policy Engine (`packages/policy-engine`) applies configurable rules for secret detection, deduplication scoring, relevance evaluation, and tenant isolation. This boundary guarantees that promotion decisions are reproducible, auditable, and free from stochastic LLM behavior.

### 3. Storage Boundary

The canonical control plane (`apps/api`) owns truth. All curated memories, lifecycle states, governance records, and audit logs live in the canonical store. qmd indexes and git exports are downstream replicas optimized for their respective use cases (search and distribution). The storage boundary prevents downstream systems from becoming accidental sources of truth.

### 4. Distribution Boundary

Git export (`apps/git-exporter`) is a read-only mirror of curated knowledge. It publishes structured Markdown + frontmatter to configurable git repositories. Git is a distribution tool in this architecture — not a database, not a governance platform, and not the source of truth.

## Component Descriptions

### packages/claude-runtime — Claude Runtime

Intercepts memory proposals from Claude Code sessions. Hooks into session lifecycle events, extracts structured memory candidates from session context, and writes raw candidates to the local inbox spool. Applies a pre-policy secret detection filter to catch obvious secrets (API keys, tokens, passwords) before they ever reach the governance pipeline. This is the entry point for all knowledge entering the system.

### packages/policy-engine — Policy Engine

Evaluates memory candidates against configurable governance rules. The engine supports rule composition — multiple rules are evaluated in a pipeline, and each rule can pass, fail, or flag a candidate. Rule types include:

- **Secret detection**: Pattern-based scanning for API keys, JWT tokens, connection strings, private keys, and environment variable values.
- **Deduplication scoring**: Similarity comparison against existing curated memories to prevent redundant storage.
- **Relevance evaluation**: Deterministic scoring based on candidate metadata, source context, and content quality signals.
- **Tenant isolation**: Enforces project/team scoping to prevent cross-project contamination.

All policy decisions are deterministic and logged. No LLM-based approval is permitted.

### packages/schema — Schema

Zod schemas defining the complete domain model. All data shapes flow from this package:

- **MemoryCandidate**: Raw memory proposal from a Claude Code session (pre-governance).
- **CuratedMemory**: Promoted, validated memory that has passed governance review.
- **MemoryLifecycle**: State machine for memory status (active, deprecated, superseded, archived).
- **GovernancePolicy**: Configurable rule definitions for the policy engine.
- **SearchQuery**: Structured search request with scope, filters, and curated-only default.
- **SearchResult**: Search response with relevance scoring and provenance metadata.

TypeScript types are derived directly from Zod schemas, ensuring runtime validation and compile-time type safety share a single source of truth.

### packages/qmd-adapter — qmd Adapter

Wraps the qmd CLI for programmatic access from TypeScript. Provides:

- Index lifecycle management (create, update, delete).
- Search interface with curated-only default semantics (inbox and archive excluded unless explicitly requested).
- Bulk indexing operations for initial sync and re-indexing.
- Health checks for qmd availability and index integrity.

This package treats qmd as an edge retrieval tool — fast local search — not a governance or storage system.

### packages/repo-resolver — Repo Resolver

Resolves multi-repo context to determine memory scoping. Given a Claude Code session context, determines which project, team, and tenant a memory candidate belongs to. Provides tenant identifiers used by the policy engine for isolation enforcement and by the search layer for scope filtering.

### packages/common — Common Utilities

Shared cross-cutting utilities: structured logging, error types, configuration loading from environment and config files, date/time helpers, and retry/backoff utilities. Kept deliberately minimal — only code that genuinely serves multiple packages belongs here.

### apps/api — Control Plane API

Fastify-based REST API serving as the central authority for memory operations:

- **Memory CRUD**: Create, read, update, and delete curated memories.
- **Search**: Delegates search queries to the qmd adapter, enforcing curated-only defaults.
- **Governance**: Rule management, policy configuration, tenant administration.
- **Analytics**: Exposes memory lifecycle metrics and audit trail data.
- **Auth**: Authentication and authorization for team access control.

### apps/curator — Curator Engine

The promotion pipeline that moves memory through lifecycle states:

1. **Intake**: Reads candidates from the inbox spool.
2. **Validation**: Runs candidates through the policy engine.
3. **Deduplication**: Compares against existing curated memories using similarity scoring.
4. **Supersession**: Detects when a new memory replaces or updates an existing one.
5. **Promotion**: Assigns lifecycle state (active) and writes to canonical store.

The curator is a batch/event-driven processor, not a request-response service.

### apps/edge-daemon — Edge Daemon

Syncs canonical store contents to local qmd indexes. Runs as a background daemon on developer machines:

- Polls or subscribes to canonical store changes.
- Performs incremental sync — only indexes changed memories.
- Handles conflict resolution when concurrent edits occur.
- Maintains per-project qmd indexes (never cross-pollinates).

### apps/git-exporter — Git Exporter

Publishes curated knowledge to configurable git repositories:

- Incremental export — only writes changed memories since last export.
- Output format: Markdown files with YAML frontmatter containing metadata.
- Supports multiple target repositories for different teams/projects.
- Git is a distribution mirror; the exporter is a one-way push.

### apps/reporting — Reporting

Analytics and observability for the knowledge platform:

- Memory lifecycle analytics (promotion rates, deprecation velocity, supersession chains).
- Search usage metrics (query volume, result relevance, zero-result rates).
- Governance audit trail (who promoted/demoted/archived what, when, and why).
- Team knowledge health dashboards (coverage, staleness, duplication ratios).

## Data Flow

```
1. CAPTURE
   Claude Code session → claude-runtime → MemoryCandidate → inbox spool

2. INTAKE
   Curator reads inbox spool → batch of raw candidates

3. POLICY EVALUATION
   Candidates → policy-engine → pass/fail/flag decisions (deterministic)

4. PROMOTION
   Passed candidates → dedup check → supersession check → CuratedMemory → canonical store

5. EDGE SYNC
   Canonical store changes → edge-daemon → local qmd index update

6. GIT EXPORT
   Canonical store changes → git-exporter → Markdown + frontmatter → git repo push

7. SEARCH
   Search query → api → qmd-adapter → qmd index → curated results only (default)
```

## Search Architecture

Default search queries the curated index only. Inbox (raw, unvetted candidates) and archived (deprecated/superseded) content are excluded from search results unless the caller explicitly requests them with a scope override. This ensures that teams only discover governed, validated knowledge by default.

Search is local-first: qmd indexes run on developer machines, synced by the edge daemon. The control plane API also provides a search endpoint that delegates to the qmd adapter for server-side search when needed.

## Tenant Isolation

Memories are scoped to a team and project. Cross-project contamination is prevented at multiple layers:

- **Capture**: The repo-resolver assigns tenant identifiers during memory extraction.
- **Policy**: The policy engine enforces tenant isolation rules during evaluation.
- **Storage**: The canonical store partitions memories by tenant.
- **Search**: qmd indexes are per-project; the edge daemon never cross-pollinates.
- **Export**: Git export targets are per-project/team.

## Explicit Non-Goals

The following are deliberately out of scope for this architecture:

- **Forking qmd**: We use qmd as-is. We wrap it, we don't modify it.
- **Using git as a database**: Git is a distribution mirror. The canonical store is the source of truth.
- **LLM-based governance decisions**: All promotion, demotion, and policy evaluation is deterministic code. LLMs propose memory; they do not govern it.
- **Replacing Claude's built-in memory**: This system complements Claude's personal memory with a governed team layer. It does not override or replace Claude's native memory features.
