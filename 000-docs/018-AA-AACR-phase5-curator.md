# Phase 5 After Action Review — Curator Engine

## Date

2026-03-18

## Scope

Phase 5 implemented the memory promotion and governance pipeline: spool intake, deduplication, policy evaluation, supersession detection, and promotion/rejection.

## What Was Delivered

### Curator (`apps/curator`)

- **Spool Intake**: Reads JSONL spool files from claude-runtime, inserts new candidates into store. Idempotent — skips already-ingested candidates by ID.
- **Dedup Checker**: Exact content hash match against curated memories. Returns `DedupResult` with match details.
- **Supersession Detector**: Jaccard word-token similarity on titles, filtered by same category + tenant. Configurable threshold (default 0.6).
- **Promoter**: Creates `CuratedMemory` from candidate + evaluations. Handles supersession (marks old memory as superseded with link). Records audit events.
- **Rejector**: Records audit events for rejected/flagged candidates. Returns rejection reason string.
- **Curator Orchestrator**: Per-candidate pipeline: hash → dedup → policy → supersession → promote/reject. Batch processing and dry-run mode.
- 79 tests

## Pipeline Flow

1. Compute content hash
2. Exact dedup check (hash lookup in store)
3. Load tenant governance policy
4. Run `PolicyPipeline.evaluate()` — returns approved/rejected/flagged
5. If rejected/flagged → `Rejector` (audit + failure reason)
6. Run supersession detection (title similarity, same category+tenant)
7. If supersedes → `Promoter` with supersession (old memory → 'superseded', new → 'active')
8. Else → `Promoter` without supersession

## Key Design Decisions

- **No policy = auto-approve**: If no enabled governance policy exists for a tenant, candidates pass through to promotion. This prevents blocking in unconfigured environments.
- **Dry-run mode**: Full pipeline executes but nothing persists. Useful for preview/testing.
- **Supersession link direction**: The OLD memory gets the `supersession.supersededBy` field pointing to the NEW memory. The new memory has no supersession link.
- **Audit action for rejection**: Uses `deleted` action (closest available AuditAction enum value).

## Test Count

79 new tests. Cumulative: 602.

## Lessons Learned

- Jaccard similarity works well for title matching but may false-positive on very short titles (2-3 words). Threshold of 0.6 is a reasonable default.
- Dry-run mode was trivial to implement since all persistence is concentrated in the promote/reject functions.
- Spool re-ingestion guard (check by candidate ID) prevents duplicates without needing file tracking.
