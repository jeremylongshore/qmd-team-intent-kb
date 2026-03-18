# CLAUDE.md — qmd-team-intent-kb

## What This Repo Is

A governed team memory platform for Claude Code powered by qmd. This is a TypeScript/Node.js monorepo providing orchestration, governance, lifecycle management, and team-shared memory for Claude Code sessions.

**This is not**: a qmd fork, not git-as-database, not prompt-only memory governance.

## Architecture Thesis

1. Claude Code proposes memory candidates during sessions
2. Deterministic code (not LLM judgment) decides what becomes durable team memory
3. qmd serves as the local retrieval/index edge engine
4. A canonical memory control plane owns truth, lifecycle, governance, dedupe, and analytics
5. Git is a mirror/export/distribution layer, not the canonical database
6. Default search targets curated knowledge only
7. Inbox/archive content must not pollute default search

## Monorepo Layout

- `apps/api/` — Control plane REST API
- `apps/curator/` — Memory promotion, dedupe, supersession engine
- `apps/edge-daemon/` — Local qmd sync daemon
- `apps/git-exporter/` — Git mirror/export service
- `apps/reporting/` — Analytics and lifecycle reporting
- `packages/schema/` — Shared domain model and validation schemas
- `packages/qmd-adapter/` — qmd integration adapter
- `packages/claude-runtime/` — Claude Code session capture runtime
- `packages/policy-engine/` — Memory governance policy evaluation
- `packages/repo-resolver/` — Multi-repo context resolver
- `packages/common/` — Shared utilities
- `kb-export/` — Git export mirror output
- `000-docs/` — All durable documentation (flat, numbered)
- `tests/` — Integration and e2e tests
- `scripts/` — Build, release, and maintenance scripts
- `examples/` — Usage examples and sample configurations

## Build Commands

```
pnpm install          # Install all dependencies
pnpm validate         # Run format:check + lint + typecheck + test
pnpm lint             # ESLint across all packages
pnpm format           # Prettier format
pnpm format:check     # Prettier check without writing
pnpm typecheck        # TypeScript type checking
pnpm test             # Run all tests
pnpm test:ci          # Run tests in CI mode
pnpm clean            # Remove all dist/build artifacts
```

## Rules for Working in This Repo

### Before Starting Any Work

1. Verify whether previous work already exists — read recent commits, open PRs, branch state
2. Check comments, review feedback, and open TODOs for requested fixes
3. Address any required fixes before starting new work
4. Run `/repo-sweep` when relevant to clear stale branches/PRs

### Doc Filing (000-docs/)

- All durable documentation lives flat in `000-docs/` with `/doc-filing` convention
- Format: `NNN-CC-ABCD-description.md` (e.g., `001-AT-ARCH-repo-blueprint.md`)
- CC = 2-letter category code (AT, PP, TQ, DR, etc.), ABCD = 4-letter type code (ARCH, PLAN, TEST, etc.)
- Never create subdirectories under 000-docs
- Architecture, phase plans, AARs, risk registers, and policy docs go here
- Ephemeral task notes do NOT go in 000-docs — use Beads instead
- When filing a new doc, use the next available number and run `/doc-filing` for proper naming
- See `000-docs/000-INDEX.md` for current inventory

### Beads Usage

- Never code without first marking a Beads task as in_progress
- Never finish work without closing the Beads task with evidence
- Always `bd sync` after closing
- Use `/beads` at session start for context recovery
- Workflow: `bd update <id> --status in_progress` → work → `bd close <id> --reason "evidence"` → `bd sync`

### Release Hygiene

- Follow Semantic Versioning strictly
- CHANGELOG.md uses Keep a Changelog format
- Every user-facing change needs a changelog entry
- No "misc cleanup" entries — be specific about what changed and why
- Use `/release` skill for release preparation
- Prerelease versions for risky changes: `X.Y.Z-alpha.N`

### Scaffolding vs Implemented

- Be explicit about what is currently scaffolding (placeholder structure) vs implemented (working code)
- Placeholder packages contain only package.json, tsconfig.json, and src/index.ts with a TODO comment
- Do not claim features work when they are only scaffolded
- Update `000-docs/004-PP-RMAP-phase-plan.md` when implementation status changes

### Changelog Discipline

- Update CHANGELOG.md in every PR that adds, changes, or fixes user-facing behavior
- Use categories: Added, Changed, Fixed, Security, Deprecated, Removed
- Write human-readable entries from the user's perspective
- Link to PRs or issues where helpful

### Documentation Updates

- When architecture or phase intent changes, update the relevant 000-docs files
- Keep `002-AT-ARCH-architecture-overview.md` and `004-PP-RMAP-phase-plan.md` current
- Produce AARs (After Action Reviews) for significant work milestones — file as next numbered doc in 000-docs

### Enterprise Mode Standards

- All code must pass lint, format, and type checks
- All PRs require review (human + Gemini automated review)
- Security considerations documented for every new subsystem
- Dependency updates reviewed, not auto-merged
- Secrets never committed — use environment variables and GitHub secrets

## Testing

- Unit tests: Vitest, co-located with source in `__tests__/` dirs
- Integration tests: `tests/` directory at repo root
- All PRs must pass `pnpm validate` before merge
- Coverage targets will be set per-package as implementation progresses

## GCP Integration

- Gemini code review runs on all PRs via GitHub Actions + Workload Identity Federation
- No secrets stored — WIF provides tokenless authentication
- GCP project and WIF configured via GitHub repository variables
