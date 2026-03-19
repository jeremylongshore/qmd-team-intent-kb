# Phase 7 After Action Review — Reporting & Analytics

## What Was Planned

Phase 7 in the original phase plan was described as "Git Export" — publishing curated knowledge to git repositories. However, git export was actually delivered in Phase 6. Phase 7 was repurposed for reporting and analytics.

## What Was Delivered

- `apps/reporting/` — Analytics and lifecycle reporting application
- Memory aggregator: counts by lifecycle state, category, sensitivity, tenant
- Policy aggregator: evaluation pass/fail rates, rule-level statistics
- Lifecycle formatters: human-readable report generation
- 53 new tests covering all aggregators and formatters

## What Went Well

- Clean separation of aggregation logic from formatting
- Repository pattern from store package made data access straightforward
- Test coverage was comprehensive from the start
- Deterministic time injection (`nowFn`) pattern continued to work well

## What Could Be Improved

- Phase numbering drifted from the original plan — Phase 7 plan says "Git Export" but actual Phase 7 is "Reporting." This creates confusion when reading docs.
- No dashboard UI — reporting is code-only with formatters. A future phase could add a web dashboard.

## Lessons

- When phases are delivered out of planned order, update the phase plan immediately to avoid doc drift.
- Formatter/aggregator split is a good pattern for reporting — keeps concerns clean.
