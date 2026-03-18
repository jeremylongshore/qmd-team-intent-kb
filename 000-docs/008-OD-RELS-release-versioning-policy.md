# Release and Versioning Policy

> Defines how qmd-team-intent-kb versions its packages, manages changelogs, and ships releases. This policy applies to all packages and apps in the monorepo.

---

## Semantic Versioning

This project follows [Semantic Versioning 2.0.0](https://semver.org/) for all published packages.

### Version Components

| Component           | When to Increment                                                               | Examples                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **MAJOR** (`X.0.0`) | Breaking changes to public API, schema shape, or search behavior                | Change MemoryCandidate schema fields, change search API response structure, change tenant isolation model |
| **MINOR** (`0.X.0`) | New features, new memory categories, new policy rules — all backward compatible | Add a new GovernancePolicy rule type, add a new search filter, add git export format                      |
| **PATCH** (`0.0.X`) | Bug fixes, documentation corrections, dependency updates                        | Fix a bug in curator dedup logic, fix a typo in API response, update a dependency                         |

### Pre-release Versions

Pre-release versions follow the pattern `X.Y.Z-<stage>.N`:

| Stage   | Purpose                                                  | Stability                                            |
| ------- | -------------------------------------------------------- | ---------------------------------------------------- |
| `alpha` | Early development, API may change significantly          | Unstable — expect breakage                           |
| `beta`  | Feature-complete for the target release, API stabilizing | Semi-stable — breaking changes possible but unlikely |
| `rc`    | Release candidate, final validation                      | Stable — only critical bug fixes                     |

Examples: `0.1.0-alpha.1`, `0.2.0-beta.3`, `1.0.0-rc.1`

---

## When to Bump What

Choosing the correct version increment is critical. When in doubt, choose the more conservative (higher) bump.

### Patch Examples

- Fix a bug in the curator deduplication logic that caused false positives
- Fix a typo in an API error message
- Update a devDependency to a newer version
- Fix a broken link in documentation
- Correct a Zod schema validation that was too permissive

### Minor Examples

- Add a new `GovernancePolicy` rule type (e.g., `content_language`)
- Add a new search filter (e.g., filter by `promotedBy`)
- Add a new memory export format (e.g., git-backed export)
- Add a new `AuditEvent` action type
- Add a new optional field to an existing schema
- Add a new CLI command to `qmd-team-intent-kb`

### Major Examples

- Remove or rename a field in `MemoryCandidate` or `CuratedMemory`
- Change the shape of `SearchResult` (e.g., rename `memories` to `results`)
- Change the tenant isolation model
- Remove a `GovernancePolicy` rule type
- Change the default `SearchQuery.scope` from `curated` to `all`
- Change an enum value (e.g., rename a category)

### Pre-release Examples

- Any change that needs validation before stable release
- Large features being developed incrementally
- Schema changes being tested against real data

---

## Breaking Change Definition

A **breaking change** is any modification that requires consumers to change their code, configuration, or data to continue working correctly. Specifically:

- **Schema changes**: Field removals, field renames, type changes, required field additions
- **Enum changes**: Value removals, value renames (additions are minor, not breaking)
- **API changes**: Endpoint removals, response shape changes, behavior changes for existing endpoints
- **Search changes**: Changes to default scope, changes to ranking algorithm that significantly alter result order
- **Configuration changes**: Removal of config options, changes to default values that alter behavior
- **Data migration**: Any change that requires existing stored data to be transformed

Breaking changes must be:

1. Documented in the changelog with a clear migration guide
2. Announced at least one minor version in advance via deprecation warnings where possible
3. Accompanied by migration tooling when the change affects stored data

---

## Changelog Management

### Format

This project uses the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

### Rules

1. **Every PR with user-facing changes must add an entry to the `[Unreleased]` section** of `CHANGELOG.md`.
2. **Use the correct category**:
   - **Added**: New features, new capabilities
   - **Changed**: Changes to existing functionality
   - **Fixed**: Bug fixes
   - **Security**: Security-related fixes or improvements
   - **Deprecated**: Features that will be removed in a future version
   - **Removed**: Features that have been removed
3. **Entries must be human-readable**. Describe the impact, not the implementation.
   - Good: "Add `content_language` governance rule type for filtering non-English memories"
   - Bad: "Add new enum value to PolicyRule type"
   - Unacceptable: "misc fixes", "various improvements", "cleanup"
4. **Link to PR numbers** where helpful: `Add tenant-scoped search filters (#42)`
5. **Group related entries** under the same category, but keep each entry as a separate bullet.

### Example

```markdown
## [Unreleased]

### Added

- Add `content_language` governance rule type for filtering non-English memories (#42)
- Add `promotedBy` filter to SearchQuery (#45)

### Fixed

- Fix false positive deduplication when content differs only in whitespace (#43)

### Security

- Add rate limiting to search endpoint to prevent enumeration attacks (#44)
```

---

## Release Workflow

### Standard Release

1. **Create release branch**: `git checkout -b release/vX.Y.Z develop`
2. **Move changelog entries**: Move all entries from `[Unreleased]` to a new `[X.Y.Z] - YYYY-MM-DD` section
3. **Update package versions**: Run `pnpm version:bump X.Y.Z` across all workspace packages (or update manually if the script is not yet available)
4. **Run full validation**: `pnpm validate` — this runs lint, format check, typecheck, and all tests
5. **Create PR to main**: Open PR with title `chore(release): prepare vX.Y.Z`
6. **Review and merge**: Standard review process. CI must pass.
7. **Tag the release**: After merge to main, tag with `vX.Y.Z`
8. **Create GitHub release**: Use the changelog excerpt as release notes
9. **Use `/release` skill**: For guided execution of steps 1-8

### Hotfix Release

For critical bugs or security issues that need to ship immediately:

1. **Create fix branch from main**: `git checkout -b fix/description main`
2. **Apply the fix**: Minimal change, focused on the issue
3. **Add changelog entry**: Under `[Unreleased]` with appropriate category
4. **Run full validation**: `pnpm validate`
5. **Fast-track PR to main**: Request expedited review
6. **Follow standard tagging and release**: Steps 7-8 above

### Post-release

After every release:

1. Merge main back into develop (if using gitflow)
2. Verify the GitHub release is published correctly
3. Update any external references to the latest version
4. Close related Beads tasks and issues

---

## Release Cadence

There is no fixed release schedule. We release when there is meaningful value to deliver.

**Guidelines**:

- Do not release half-baked features. If a feature is not complete, it should not be in the release.
- Do not hold releases for unrelated features. If a bug fix is ready, release it.
- Aim for small, frequent releases over large, infrequent ones.
- Pre-release versions can be published more aggressively for validation.

---

## Monorepo Versioning Strategy

All packages in the monorepo share a single version number. This simplifies dependency management and ensures consumers always use compatible versions across the workspace.

If this strategy becomes a constraint (e.g., one package needs frequent patches while others are stable), we will revisit and consider independent versioning with a tool like Changesets.

---

## Version Lifecycle

```
Development (0.x.x)
  Unstable API, rapid iteration, breaking changes allowed in minor versions
  Current phase: 0.x.x

Pre-1.0 Stability Promise
  0.1.x — Schema and domain model (Phase 1-2)
  0.2.x — Search and governance pipeline (Phase 3-4)
  0.3.x — MCP integration and CLI (Phase 5-6)
  0.4.x — Team features and multi-tenant (Phase 7-8)
  0.9.x — Release candidates, stabilization

1.0.0 — First stable release
  Full semver guarantees from this point forward
  Breaking changes only in major versions
```
