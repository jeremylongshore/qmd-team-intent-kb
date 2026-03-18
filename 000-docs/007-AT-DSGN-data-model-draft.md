# Data Model Draft

> Draft domain model for qmd-team-intent-kb. These types define the governed memory lifecycle from capture through curation, search, and audit. Schemas will be implemented as Zod definitions in `packages/schema` during Phase 1.

---

## MemoryCandidate

A raw memory proposed by Claude Code (or another source) before governance review. Every memory enters the system as a candidate in the inbox.

| Field                | Type                | Description                                                                                     |
| -------------------- | ------------------- | ----------------------------------------------------------------------------------------------- |
| `id`                 | `string` (UUID v4)  | Unique identifier for this candidate                                                            |
| `source`             | `enum`              | Origin of the memory: `claude_session`, `manual`, `import`, `mcp`                               |
| `sourceSessionId`    | `string`            | Identifier for the session that produced this memory (Claude session ID, import batch ID, etc.) |
| `content`            | `string`            | The raw memory content — Markdown-formatted text                                                |
| `contentHash`        | `string` (SHA-256)  | Hash of `content` for deduplication and integrity verification                                  |
| `metadata`           | `object`            | Structured context (see below)                                                                  |
| `metadata.project`   | `string`            | Project name or identifier                                                                      |
| `metadata.repo`      | `string`            | Git repository URL or slug                                                                      |
| `metadata.branch`    | `string`            | Git branch active when the memory was captured                                                  |
| `metadata.filePaths` | `string[]`          | Files relevant to this memory                                                                   |
| `metadata.tags`      | `string[]`          | Freeform tags for categorization                                                                |
| `capturedAt`         | `string` (ISO 8601) | Timestamp when the memory was captured                                                          |
| `capturedBy`         | `string`            | User identifier (e.g., GitHub username, email)                                                  |
| `mcpSource`          | `string` (optional) | MCP server name if `source` is `mcp`                                                            |
| `trustLevel`         | `enum`              | Trust classification: `high`, `medium`, `low`, `untrusted`                                      |
| `status`             | `literal`           | Always `'inbox'` — candidates are inbox items by definition                                     |

### Notes on MemoryCandidate

- The `contentHash` enables deduplication before governance review — identical content from different sessions should be flagged, not duplicated.
- The `trustLevel` is determined at capture time based on source. Claude sessions from known users start at `medium`; MCP sources start at `low` unless explicitly trusted; manual entries from authenticated users start at `high`.
- The `metadata.filePaths` field captures the files Claude Code was working with when the memory was generated. This provides provenance for architecture and troubleshooting memories.

---

## CuratedMemory

A promoted, governed memory that has passed through the governance pipeline and is available for search and retrieval. This is the core entity that Claude Code sessions consume.

| Field                      | Type                          | Description                                                                                                       |
| -------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `id`                       | `string` (UUID v4)            | Unique identifier for the curated memory                                                                          |
| `candidateId`              | `string` (UUID v4)            | Link to the original MemoryCandidate                                                                              |
| `content`                  | `string`                      | The curated content — may be edited from the original candidate                                                   |
| `contentHash`              | `string` (SHA-256)            | Hash of curated `content`                                                                                         |
| `title`                    | `string`                      | Human-readable title for display and quick scanning                                                               |
| `summary`                  | `string`                      | One-to-three sentence summary for search result previews                                                          |
| `category`                 | `enum`                        | Classification: `decision`, `pattern`, `convention`, `architecture`, `troubleshooting`, `onboarding`, `reference` |
| `metadata`                 | `object`                      | Structured context (see below)                                                                                    |
| `metadata.project`         | `string`                      | Project scope                                                                                                     |
| `metadata.repo`            | `string`                      | Repository scope                                                                                                  |
| `metadata.tags`            | `string[]`                    | Curated tags (may differ from candidate tags)                                                                     |
| `metadata.relatedMemories` | `string[]`                    | IDs of related CuratedMemory entries                                                                              |
| `lifecycle`                | `enum`                        | Current state: `active`, `deprecated`, `superseded`, `archived`                                                   |
| `supersededBy`             | `string` (optional)           | ID of the CuratedMemory that replaces this one (set when `lifecycle` is `superseded`)                             |
| `promotedAt`               | `string` (ISO 8601)           | Timestamp when the candidate was promoted to curated                                                              |
| `promotedBy`               | `string`                      | User who approved promotion                                                                                       |
| `promotionReason`          | `string`                      | Why this memory was promoted — provides audit context                                                             |
| `lastVerifiedAt`           | `string` (ISO 8601)           | Timestamp of last verification that this memory is still accurate                                                 |
| `expiresAt`                | `string` (ISO 8601, optional) | Optional expiration date — memories past this date are flagged for re-verification                                |
| `version`                  | `number`                      | Monotonically increasing version number, starting at 1                                                            |
| `tenant`                   | `string`                      | Team or project isolation key — ensures memories are scoped to the correct organizational boundary                |

### Notes on CuratedMemory

- The `category` enum is deliberately constrained. New categories require an RFC and schema migration. This prevents tag sprawl and ensures memories are consistently classified.
- The `lifecycle` field tracks memory freshness. Active memories are returned in search by default. Deprecated memories are excluded unless explicitly requested. Superseded memories point to their replacement. Archived memories are retained for audit but excluded from all search scopes.
- The `version` field increments on every edit. Combined with AuditEvent records, this provides a complete edit history.
- The `tenant` field is the primary isolation mechanism. All queries are tenant-scoped. Cross-tenant access is never implicit.

### Category Definitions

| Category          | Use For                                   | Examples                                   |
| ----------------- | ----------------------------------------- | ------------------------------------------ |
| `decision`        | Technical decisions and their rationale   | "We chose Zod over io-ts because..."       |
| `pattern`         | Recurring implementation patterns         | "Error handling pattern for MCP calls"     |
| `convention`      | Team coding standards and agreements      | "All API responses use camelCase"          |
| `architecture`    | System design and structural choices      | "Monorepo workspace layout rationale"      |
| `troubleshooting` | Known issues and their resolutions        | "Fix for pnpm workspace hoisting conflict" |
| `onboarding`      | Context new contributors need             | "How to set up the local dev environment"  |
| `reference`       | External resources, links, specifications | "qmd CLI documentation links"              |

---

## GovernancePolicy

Rules that control how MemoryCandidates are evaluated for promotion. Policies are composed of ordered PolicyRules.

| Field              | Type               | Description                                            |
| ------------------ | ------------------ | ------------------------------------------------------ |
| `id`               | `string` (UUID v4) | Unique identifier                                      |
| `name`             | `string`           | Human-readable policy name                             |
| `description`      | `string`           | What this policy does and why it exists                |
| `rules`            | `PolicyRule[]`     | Ordered list of rules to evaluate                      |
| `priority`         | `number`           | Evaluation order — lower numbers run first             |
| `enabled`          | `boolean`          | Whether this policy is active                          |
| `scope`            | `object`           | Where this policy applies (see below)                  |
| `scope.tenants`    | `string[]`         | Tenant IDs this policy applies to (empty = all)        |
| `scope.categories` | `string[]`         | Memory categories this policy applies to (empty = all) |
| `scope.sources`    | `string[]`         | Memory sources this policy applies to (empty = all)    |

### Notes on GovernancePolicy

- Policies are evaluated in priority order. A `reject` action from any rule short-circuits evaluation — the candidate is rejected immediately.
- The `scope` mechanism allows policies to be targeted. A secret detection policy applies to all tenants and sources, but a stricter relevance threshold might only apply to `mcp` sources.
- Default policies are created during tenant onboarding. Teams can customize but cannot disable security-critical policies (secret detection, for example).

---

## PolicyRule

An individual governance rule within a GovernancePolicy. Each rule evaluates one aspect of a MemoryCandidate.

| Field        | Type                      | Description                                                                                                       |
| ------------ | ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `type`       | `enum`                    | Rule type: `secret_detection`, `dedup_check`, `relevance_score`, `content_length`, `source_trust`, `tenant_match` |
| `parameters` | `Record<string, unknown>` | Type-specific configuration                                                                                       |
| `action`     | `enum`                    | What happens when the rule triggers: `reject`, `flag`, `approve`, `require_review`                                |
| `threshold`  | `number` (optional)       | Numeric threshold for score-based rules                                                                           |

### Rule Type Details

| Type               | Purpose                                       | Key Parameters                                   | Typical Action   |
| ------------------ | --------------------------------------------- | ------------------------------------------------ | ---------------- |
| `secret_detection` | Scan content for secrets, tokens, keys        | `patterns: string[]`, `customPatterns: string[]` | `reject`         |
| `dedup_check`      | Check for duplicate or near-duplicate content | `similarityThreshold: number` (0-1)              | `flag`           |
| `relevance_score`  | Evaluate memory quality and relevance         | `minScore: number`                               | `require_review` |
| `content_length`   | Enforce minimum/maximum content length        | `minLength: number`, `maxLength: number`         | `reject`         |
| `source_trust`     | Filter by source trust level                  | `minTrustLevel: string`                          | `flag`           |
| `tenant_match`     | Ensure memory belongs to correct tenant       | `strict: boolean`                                | `reject`         |

### Rule Evaluation Semantics

- Rules within a policy are evaluated in array order.
- `reject`: Candidate is rejected. No further rules are evaluated. Rejection is logged in AuditEvent.
- `flag`: Candidate is flagged for human review but continues evaluation.
- `approve`: Candidate passes this rule. Evaluation continues.
- `require_review`: Candidate requires explicit human approval before promotion.
- A candidate must pass all rules (no `reject`) and have no unresolved `require_review` flags to be auto-promoted.

---

## SearchQuery

A search request against the memory knowledge base.

| Field               | Type       | Description                                                   |
| ------------------- | ---------- | ------------------------------------------------------------- |
| `query`             | `string`   | Natural language or keyword search query                      |
| `scope`             | `enum`     | Search scope: `curated` (default), `all`, `inbox`, `archived` |
| `filters`           | `object`   | Optional filters (see below)                                  |
| `filters.tenant`    | `string`   | Restrict to a specific tenant                                 |
| `filters.category`  | `string`   | Restrict to a specific category                               |
| `filters.tags`      | `string[]` | Require all specified tags                                    |
| `filters.dateRange` | `object`   | `{ from: ISO timestamp, to: ISO timestamp }`                  |
| `limit`             | `number`   | Maximum results to return (default: 20, max: 100)             |
| `offset`            | `number`   | Pagination offset (default: 0)                                |

### Notes on SearchQuery

- The `scope` default is `curated` — normal Claude Code sessions should only see governed, promoted memories.
- The `all` scope includes inbox candidates and is intended for administrative use only.
- The `archived` scope is for audit and compliance queries.
- Search is delegated to qmd for vector/semantic search. The control plane adds tenant isolation and governance filtering on top of qmd's results.

---

## SearchResult

The response to a SearchQuery.

| Field              | Type              | Description                                        |
| ------------------ | ----------------- | -------------------------------------------------- |
| `memories`         | `CuratedMemory[]` | Matching memories, ordered by relevance            |
| `total`            | `number`          | Total number of matching memories (for pagination) |
| `query`            | `SearchQuery`     | The original query (echoed back for reference)     |
| `searchDurationMs` | `number`          | Time taken to execute the search in milliseconds   |

### Notes on SearchResult

- The `memories` array respects the `limit` and `offset` from the query.
- The `total` count reflects all matches, not just the current page.
- The `searchDurationMs` field is for performance monitoring. Search times above 500ms should trigger investigation.

---

## AuditEvent

An immutable audit trail entry for every significant action in the system.

| Field       | Type                      | Description                                                                                       |
| ----------- | ------------------------- | ------------------------------------------------------------------------------------------------- |
| `id`        | `string` (UUID v4)        | Unique identifier                                                                                 |
| `action`    | `enum`                    | What happened: `promoted`, `demoted`, `superseded`, `archived`, `deleted`, `searched`, `exported` |
| `memoryId`  | `string`                  | The memory this event relates to                                                                  |
| `actor`     | `string`                  | Who performed the action (user identifier or `system`)                                            |
| `timestamp` | `string` (ISO 8601)       | When the action occurred                                                                          |
| `reason`    | `string`                  | Why the action was taken — required for all non-search actions                                    |
| `metadata`  | `Record<string, unknown>` | Additional context (policy ID for governance actions, query for search actions, etc.)             |

### Notes on AuditEvent

- Audit events are append-only. They are never modified or deleted.
- The `searched` action is logged at a lower frequency (sampled) to avoid overwhelming the audit log. All other actions are logged individually.
- The `exported` action tracks when memories are exported for backup or migration, providing chain-of-custody.
- The `reason` field is required for all mutation actions. Automated actions (governance pipeline) use the policy name and rule type as the reason.

---

## Entity Relationships

```
MemoryCandidate --[promoted to]--> CuratedMemory
CuratedMemory --[superseded by]--> CuratedMemory
CuratedMemory --[related to]--> CuratedMemory (many-to-many via metadata.relatedMemories)
GovernancePolicy --[contains]--> PolicyRule[]
GovernancePolicy --[evaluates]--> MemoryCandidate
AuditEvent --[references]--> CuratedMemory | MemoryCandidate
SearchQuery --[returns]--> SearchResult --[contains]--> CuratedMemory[]
```

## Open Questions

These will be resolved during Phase 1 schema implementation:

1. **Versioned content storage**: Should we store full content at each version, or use diffs? Full content is simpler but uses more storage. Decision deferred until we understand typical memory size.
2. **Soft delete semantics**: Currently `archived` serves as soft delete. Do we need a separate `deleted` lifecycle state with different retention rules?
3. **Cross-tenant references**: Should `metadata.relatedMemories` be allowed to reference memories in other tenants? Current design says no — strict tenant isolation. Revisit if cross-team knowledge sharing becomes a requirement.
4. **Search ranking**: How should lifecycle state affect search ranking? Active memories should rank higher than deprecated ones, but the exact weighting needs experimentation.
5. **MCP source trust**: Should MCP sources have a trust registry, or should trust be evaluated per-memory? Registry is simpler but less flexible.
