# After Action Review — Phase 2: Claude Runtime Capture

## Summary

Implemented the capture layer that turns Claude Code session learnings into deterministic candidate events in a local spool, plus shared utilities in packages/common.

## What Was Delivered

### packages/common (pre-step)

- `Result<T, E>` discriminated union with `ok()`/`err()` constructors
- `computeContentHash()` for deterministic SHA-256 content hashing
- `resolveTeamKbPath()` with `TEAMKB_BASE_PATH` env override (~/.teamkb/)

### packages/claude-runtime

- **Types**: RawCaptureEvent, GitContext, SecretPattern, SecretMatch, RepoContextProvider
- **Config**: Three local bucket paths (spool/, failed/, redaction-audit/) with dated filenames
- **Secret detection**: 11 named patterns (JWT, AWS, GitHub, sk-\*, Slack, PEM, connection strings, Base64 auth, GCP service account, high-entropy hex, env secrets)
- **Redactor**: Replaces matches with `[REDACTED:{patternId}]`
- **Git context**: Resolves repo URL, branch, user, and tenant ID from local git
- **Candidate builder**: Builds MemoryCandidate from raw event + git context, validates against Zod schema
- **Spool writer/reader**: Append-only JSONL with atomic single-line writes
- **Failure bucket**: Routes failed candidates to separate bucket with error context
- **Redaction audit**: Logs secret detection findings for compliance
- **Templates**: Shell hook scripts (user/project/enterprise scope) and CLAUDE.md guidance blocks

## Test Coverage

- 303 total tests (243 from Phase 1 + 60 new)
- All spool tests use real temp directories (`fs.mkdtemp`)
- Secret scanner tested against known secret strings for all 11 patterns
- Candidate builder validates output against Zod schema

## Key Design Decisions

1. Append-only JSONL for spool (atomic writes, no locks)
2. Three local buckets: spool, failed, redaction-audit
3. Minimal git context inline (RepoContextProvider is the Phase 5 integration seam)
4. Templates as pure TypeScript functions returning strings (testable)
5. Secret scanner is pure — no side effects, no I/O

## What Is NOT Implemented

- No promotion logic (Phase 6)
- No canonical memory writes (spool is local only)
- No real hook installation (templates generate script content, not installed)
- No daemon or sync (Phase 8)
