# Phase 8 After Action Review — Security Hardening

## What Was Planned

Phase 8 in the original phase plan was described as "Edge Daemon" — background sync of canonical store to local qmd indexes. The actual Phase 8 implemented security hardening instead. Edge daemon is deferred to post-v1.

## What Was Delivered

- API middleware stack: rate-limiter (sliding window algorithm), API key authentication, input sanitizer with recursive object traversal
- Content classifier with sensitivity levels (public, internal, confidential, restricted)
- Two new policy rules: sensitivity-gate and content-sanitization
- Export gating in git-exporter — respects sensitivity classification
- Path-safety utilities in common package (traversal detection, null-byte detection)
- Secret detection patterns expanded (4 new patterns + 3 refined)
- 76 new tests covering all security features

## What Went Well

- Middleware pattern (rate-limiter -> auth -> sanitizer) composes cleanly with Fastify's hook system
- Content classifier is deterministic — no LLM judgment, just pattern matching
- Path-safety was a good addition to common — catches real attack vectors
- Test coverage for security code was thorough from day one

## What Could Be Improved

- Phase numbering continued to drift from the plan — should have been corrected after Phase 7
- Rate limiter uses in-memory storage — won't work for horizontally scaled deployments
- No integration tests for the full middleware stack end-to-end (unit tests only)

## Lessons

- Security hardening benefits from being a dedicated phase rather than sprinkled across features.
- Deterministic classification (pattern matching, not ML) is the right call for a governance system — auditable and predictable.
- In-memory rate limiting is fine for v1 but should be flagged as a scaling concern.
