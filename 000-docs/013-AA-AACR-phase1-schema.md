# After Action Review — Phase 1: Core Schema and Domain Model

## Summary

Implemented the complete domain model for qmd-team-intent-kb as Zod v3 schemas with derived TypeScript types, lifecycle state machine, and comprehensive test coverage.

## What Was Delivered

- **8 source modules** in `packages/schema/src/`:
  - `enums.ts` — 12 enum definitions (MemorySource, TrustLevel, MemoryCategory, MemoryLifecycleState, CandidateStatus, SearchScope, PolicyRuleType, PolicyRuleAction, AuditAction, Confidence, Sensitivity, AuthorType)
  - `common.ts` — Shared primitives (Uuid, Sha256Hash, IsoDatetime, NonEmptyString, SemVer, Tag, Author, TenantId, ContentMetadata)
  - `memory-candidate.ts` — MemoryCandidate schema with inbox status and pre-policy flags
  - `curated-memory.ts` — CuratedMemory schema with lifecycle refinement, PolicyEvaluation, SupersessionLink
  - `governance-policy.ts` — GovernancePolicy and PolicyRule schemas
  - `search.ts` — SearchQuery, SearchHit, SearchResult with curated-only default scope
  - `audit-event.ts` — AuditEvent schema for immutable audit trail
  - `lifecycle.ts` — State machine with isTransitionAllowed, validateTransition, getAllowedTransitionsFrom

- **225 tests** across 8 test files, all passing
- **Test fixture factory** in `__tests__/fixtures.ts` for reusable test data

## Key Design Decisions

1. Single CuratedMemory type with lifecycle enum field, not separate types per state
2. Candidate → curated is a creation event, not a lifecycle transition
3. camelCase field names (TypeScript convention)
4. Zod `.refine()` enforces supersession link when lifecycle is superseded
5. SearchScope defaults to curated, enforcing governed search at the schema level
6. Archived is a terminal state — no transitions out

## Lifecycle State Machine

```
active → deprecated, superseded, archived
deprecated → active (un-deprecate), archived
superseded → archived
archived → (terminal)
```

## What Went Well

- Clean separation of concerns across modules
- Comprehensive test coverage with factory fixtures
- All validation passes first try (format, lint, typecheck, test)

## Lessons Learned

- ESLint `consistent-type-imports` rule disallows `import()` type annotations in inline positions — use top-level type imports instead
- Fixture factories using `Record<string, unknown>` return types avoid coupling fixtures to Zod output types while remaining compatible with `.parse()`

## Dependencies Enabled

Phase 1 unblocks:

- Phase 2 (Claude Runtime Capture) — imports MemoryCandidate, MemorySource, TrustLevel
- Phase 3 (qmd Adapter) — imports SearchQuery, SearchResult, SearchScope
- Phase 4 (Policy Engine) — imports GovernancePolicy, PolicyRule, MemoryCandidate
