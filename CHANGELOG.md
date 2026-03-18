# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
