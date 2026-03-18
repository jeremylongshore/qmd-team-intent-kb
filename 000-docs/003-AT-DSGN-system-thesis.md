# System Thesis

## Problem Statement

Claude Code generates valuable institutional knowledge during every session — architectural decisions, debugging insights, configuration rationale, API usage patterns, codebase conventions, and hard-won lessons. Today, this knowledge is ephemeral. It lives in session context, survives until compaction or session end, and then vanishes. Teams rediscover the same insights repeatedly. There is no governed, shared memory layer.

## Current State of Claude Code Memory

Claude Code's built-in memory system has fundamental limitations for team use:

- **Personal, not shared**: Memory belongs to an individual user's Claude instance. There is no mechanism for a team of developers to share a curated knowledge base.
- **Ungoverned**: Claude decides what to remember and forget. There are no deterministic rules, no approval pipeline, no audit trail. Memory is an LLM judgment call.
- **No lifecycle management**: Memories have no explicit states (active, deprecated, superseded, archived). Stale knowledge persists alongside current knowledge with no distinction.
- **No deduplication**: The same insight captured across multiple sessions accumulates as redundant entries with no consolidation.
- **No analytics**: There is no visibility into what the team knows, what's stale, what's being searched, or what gaps exist.
- **No tenant isolation**: In multi-project environments, there is no mechanism to prevent knowledge from one project leaking into another's context.

## Thesis

Teams using Claude Code need a governed, shared memory layer with the following properties:

### 1. Automatic Capture from Claude Code Sessions

Knowledge should be captured automatically as Claude Code proposes it during sessions. Developers should not need to manually copy-paste insights into a wiki or knowledge base. The capture mechanism hooks into Claude Code's session lifecycle and extracts structured memory candidates.

### 2. Deterministic Governance Pipeline

A deterministic pipeline — not LLM judgment — decides what persists. Governance rules are code: secret detection patterns, deduplication thresholds, relevance scoring algorithms, tenant isolation boundaries. These rules are version-controlled, testable, auditable, and reproducible. When a memory is promoted, you can trace exactly which rules it passed and why.

### 3. Local-First Search via qmd

Curated knowledge is searchable locally via qmd for fast, offline-capable retrieval. Developers query their local qmd index and get results in milliseconds without network round-trips. The edge daemon keeps local indexes synchronized with the canonical store.

### 4. Canonical Control Plane

A central control plane manages truth, lifecycle, and governance. It owns the canonical state of all curated memories, their lifecycle transitions, governance records, and audit logs. Downstream systems (qmd indexes, git exports) are replicas, not authorities.

### 5. Git as Distribution Mirror

Git export distributes curated knowledge to git repositories in structured Markdown format. This enables integration with existing documentation workflows and provides a familiar interface for browsing knowledge. But git does not own the knowledge — it receives a one-way push from the canonical store.

### 6. Curated-Only Default Search

Default search only returns curated, governed content. Raw inbox candidates and archived memories never pollute search results unless explicitly requested. This guarantee ensures that developers trust what they find — every search result has passed the governance pipeline.

## Why Not Just Git?

Git is a version control and distribution tool. It excels at tracking file changes over time and distributing those changes to collaborators. It does not provide:

- **Lifecycle management**: No concept of active/deprecated/superseded/archived states for individual knowledge entries.
- **Deduplication**: No mechanism to detect and consolidate redundant content across commits and files.
- **Governance pipeline**: No deterministic evaluation of content quality, secret detection, or relevance scoring.
- **Search optimization**: Git grep is line-oriented text search, not a full-text search index with relevance scoring.
- **Tenant isolation**: No built-in multi-tenant scoping. Repository-level isolation is too coarse for teams working across projects.
- **Analytics**: No visibility into knowledge health, search patterns, or audit trails.
- **Structured metadata**: Git commits carry author/date/message, but not structured lifecycle metadata per knowledge entry.

Using git as the primary store would require building all of these capabilities on top of it — effectively building a database on top of a version control system. The architecture uses git for what it does best (distribution) and purpose-built components for governance.

## Why Not Just Prompt Memory?

Claude's prompt-based memory (CLAUDE.md files, session memory) serves a different purpose:

- **Personal scope**: Prompt memory is per-user, not team-shared.
- **No governance**: Claude decides what to remember based on LLM judgment, not deterministic rules.
- **No lifecycle**: No explicit states, no deprecation, no supersession tracking.
- **No deduplication**: Redundant memories accumulate without consolidation.
- **No analytics**: No visibility into what's remembered, what's stale, or what's missing.
- **No audit trail**: No record of why something was remembered or forgotten.

Prompt memory is valuable for personal workflow optimization. It is insufficient for governed team knowledge management.

## Why qmd?

qmd provides fast, local, full-text search and indexing. It is the right tool for edge retrieval because:

- **Local-first**: No network dependency for search. Millisecond response times.
- **Full-text indexing**: Purpose-built for document search with relevance scoring.
- **CLI-friendly**: Integrates naturally with developer workflows and tooling.
- **Lightweight**: Runs on developer machines without heavy infrastructure.

However, qmd is not a governance platform. It does not provide lifecycle management, policy evaluation, deduplication, tenant isolation, or audit logging. This repository provides that governance layer, using qmd as the edge retrieval component in a larger architecture.

## Design Principles

### 1. Determinism Over LLM Judgment for Governance

All governance decisions — promotion, demotion, deduplication, secret detection, tenant isolation — are made by deterministic code. LLMs propose memory candidates; deterministic pipelines evaluate them. This ensures reproducibility, auditability, and freedom from stochastic behavior in critical governance paths.

### 2. Curated-Only Default Search

Default search scopes to curated content exclusively. Raw inbox candidates (unvetted, potentially containing secrets or noise) and archived content (deprecated, superseded) are excluded unless the caller explicitly opts in. This principle ensures that search results are trustworthy by default.

### 3. Explicit Lifecycle

Every curated memory has an explicit lifecycle state:

- **Active**: Current, valid, searchable by default.
- **Deprecated**: Marked as outdated but retained for reference. Excluded from default search.
- **Superseded**: Replaced by a newer memory. Linked to its successor. Excluded from default search.
- **Archived**: Removed from active use. Retained for audit/compliance. Excluded from default search.

State transitions are logged with timestamp, actor, and reason.

### 4. Tenant Isolation by Default

Memories are scoped to a project and team from the moment of capture. Cross-project contamination is prevented at every layer: capture, policy evaluation, storage, search, and export. Isolation is the default — sharing across tenants requires explicit configuration.

### 5. Auditability of All Memory Operations

Every promotion, demotion, supersession, deletion, and lifecycle transition is logged with:

- Timestamp of the operation.
- Actor who initiated or triggered it.
- Reason or policy rule that justified it.
- Before and after states.

The audit trail is queryable and serves as the foundation for compliance, analytics, and debugging.

### 6. Local-First Retrieval via qmd

Developers search their local qmd index, not a remote API, for day-to-day knowledge retrieval. The edge daemon keeps local indexes fresh. The control plane API provides server-side search for administrative and cross-team use cases, but the primary developer experience is local and fast.

### 7. Git as Distribution, Not Truth

Git export is a downstream distribution mechanism. Curated knowledge is published to git repositories for browsing, integration, and distribution. Git never feeds back into the canonical store. The flow is strictly one-way: canonical store → git export. Editing a git-exported file does not update the canonical memory.
