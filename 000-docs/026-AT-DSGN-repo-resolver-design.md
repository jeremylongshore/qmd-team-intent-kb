# repo-resolver Design

## Purpose

`packages/repo-resolver` determines which repository a Claude Code session is operating against and exposes that context to the rest of the platform. Two consumers exist today:

1. **claude-runtime** — enriches `MemoryCandidate.projectContext` so curated memories are traceable to a specific repo, branch, and commit.
2. **edge-daemon** — optionally scopes spool intake to a single repo, rejecting or tagging candidates that arrived from a different working directory.

A third consumer class is anticipated but out of scope here: future reporting surfaces that slice analytics by repo.

Without a resolver, both consumers must re-implement git shellouts, monorepo detection, and tenant-id derivation ad hoc. That duplication is the problem this package solves.

## Scope

In scope:

- Detection of the enclosing git working tree from an arbitrary `cwd`.
- Extraction of `repoName`, `remoteUrl`, `branch`, and `commitSha`.
- Detection of monorepo tooling (pnpm, npm/yarn workspaces, nx, turborepo, lerna) and identification of the specific workspace package containing `cwd`.
- Deterministic `tenantId` derivation with a documented precedence order.
- Process-local caching to avoid repeated git shellouts.
- Graceful degradation for non-git, detached, bare, and no-remote cases.

Out of scope:

- Remote git operations (fetch, push, auth).
- Change detection or file-system watching.
- Mapping tenant IDs to access-control policies — that remains with `policy-engine`.
- Long-lived daemon state or cross-process caches.

## Domain Model

### `RepoContext`

```ts
export interface RepoContext {
  repoRoot: string; // absolute path to the .git parent
  repoName: string; // basename(repoRoot), lowercased
  remoteUrl: string | null; // origin remote URL, or null if unset
  branch: string | null; // current branch, or null when detached
  commitSha: string; // HEAD commit SHA (40-char hex)
  isMonorepo: boolean; // true if a workspace manifest was detected
  workspaceRoot: string | null; // monorepo root (may equal repoRoot)
  workspacePackage: string | null; // package name containing cwd, or null
}
```

Fields that can legitimately be absent are typed as nullable. Consumers must handle `null` without crashing. `commitSha` is non-nullable because a resolved working tree always has a HEAD — the no-commits edge case is treated as an unresolvable repo and surfaces as an error, not a partial context.

### `ResolverError`

```ts
export type ResolverError =
  | { kind: 'NotAGitRepo'; cwd: string }
  | { kind: 'BareRepo'; repoRoot: string }
  | { kind: 'NoCommits'; repoRoot: string }
  | { kind: 'GitUnavailable'; cause: string }
  | { kind: 'Io'; path: string; cause: string };
```

All errors are typed discriminated unions. The resolver returns `Result<RepoContext, ResolverError>` using the existing `Result<T, E>` type in `packages/common`. No exceptions cross the package boundary.

## Resolution Procedure

Given a `cwd`:

1. `realpath(cwd)` — resolve symlinks so that the cache key is canonical.
2. Invoke `git -C <cwd> rev-parse --show-toplevel --absolute-git-dir --is-bare-repository HEAD` in one call. Parse the four lines.
   - Non-zero exit with stderr matching `not a git repository` → `NotAGitRepo`.
   - `--is-bare-repository` = `true` → `BareRepo`.
   - Any other non-zero exit → `GitUnavailable`.
3. Cache lookup against `repoRoot`. If a fresh entry exists, return it.
4. Otherwise, in parallel:
   - `git -C <repoRoot> config --get remote.origin.url` → `remoteUrl` (null on non-zero exit).
   - `git -C <repoRoot> symbolic-ref --short HEAD` → `branch` (null on non-zero exit, indicating detached HEAD).
   - `HEAD` sha already captured in step 2.
5. Walk up from `cwd` toward `repoRoot` looking for workspace manifests. Stop at `repoRoot`. Detection precedence is documented in the next section.
6. Assemble `RepoContext`, insert into the cache keyed by `repoRoot`, return.

Step 2 is deliberately a single `git` invocation. Each shellout is ~10–30 ms on a warm machine; collapsing four calls into one is the primary perf lever.

## Monorepo Detection

Walk upward from `cwd` until `repoRoot`. At each directory check for workspace manifests in this precedence order, taking the first match:

1. `pnpm-workspace.yaml`
2. `package.json` with a `workspaces` field (npm, yarn)
3. `nx.json`
4. `turbo.json`
5. `lerna.json`

When a manifest is found, `workspaceRoot` is that directory. If no manifest is found, `isMonorepo = false` and `workspaceRoot = null`.

For `workspacePackage`: if `workspaceRoot` is set and differs from `cwd`, walk from `cwd` back toward `workspaceRoot` looking for the nearest `package.json` with a `name` field. That `name` is `workspacePackage`. If the nearest `package.json` is the workspace root itself, `workspacePackage` is null (cwd is at the root, not inside a workspace package).

We do not parse manifests to enumerate the full workspace list. The resolver only needs to answer "which workspace package contains cwd?" — not "which packages does this monorepo contain?".

## Tenant ID Derivation

`deriveTenantId(ctx: RepoContext, overrides?: TenantOverrides): string`

Precedence, first match wins:

1. **Environment override**: `TEAMKB_TENANT_ID` env var, when set and non-empty.
2. **Config file**: `.teamkb/config.json` in `workspaceRoot ?? repoRoot`, with shape `{ "tenantId": string }`. Missing or malformed file is skipped silently.
3. **Normalized remote URL**: applied to `ctx.remoteUrl` when non-null.
4. **Repo root basename**: `basename(ctx.repoRoot).toLowerCase()`.

### Remote URL Normalization

Given `ctx.remoteUrl`, produce a stable identifier:

- Strip protocol prefix (`https://`, `http://`, `ssh://`, `git://`, `git+ssh://`).
- Strip user-info (`git@`, `user:token@`).
- Convert `host:path` (scp-style) to `host/path` form.
- Strip trailing `.git` suffix.
- Lowercase the entire result.

Examples:

| Input                                   | Normalized                |
| --------------------------------------- | ------------------------- |
| `git@github.com:acme/repo.git`          | `github.com/acme/repo`    |
| `https://github.com/acme/repo.git`      | `github.com/acme/repo`    |
| `ssh://git@gitlab.com/team/project.git` | `gitlab.com/team/project` |
| `https://user:token@host/path`          | `host/path`               |

Auth components are always stripped. The resolver never surfaces credentials even when they appear in `git config`.

### Fallback Rationale

Every tier has a reason:

- **Env override** — operational escape hatch for CI runners and shared workstations.
- **Config file** — project-level commitment. Explicit, reviewable, committable.
- **Remote URL** — stable across clones of the same repo by different developers.
- **Basename** — last resort. Consistent on one machine, fragile across teammates who clone into differently-named directories. The resolver prefers any upstream signal before this fallback.

## Caching

The cache is a process-local `Map<string, { context: RepoContext; fetchedAt: number }>` keyed by `repoRoot`. A separate `Map<string, string>` maps `realpath(cwd)` → `repoRoot` so that repeated resolutions from subdirectories share the same entry.

TTL: 5 minutes default, configurable via `createResolver({ cacheTtlMs })`. Rationale: branch and HEAD change during normal development. A short TTL keeps context reasonably fresh without a file-system watcher.

`clearCache()` exposed for tests. No eviction policy beyond TTL — process-local memory cost is negligible for the expected repo count.

The cache is deliberately not persisted. A daemon restart should re-resolve. If this becomes a perf issue later, a disk-backed cache can be added without changing the API.

## Consumer Integration

### claude-runtime

Candidate enrichment happens at capture time. The runtime calls `resolveRepoContext(sessionCwd)` once per session start and reuses the result for all candidates in that session. On `Err`, the runtime falls back to whatever `projectContext` was already being captured pre-resolver — a non-git cwd must not block candidate capture.

### edge-daemon

Daemon support is opt-in via `DAEMON_SCOPE_BY_REPO=true`. When enabled, the daemon calls `resolveRepoContext(daemonCwd)` once at startup and tags every ingested candidate with that `repoRoot`. Candidates already tagged with a different `repoRoot` (captured in another repo by a shared runtime) are routed to an audit log and skipped. When the flag is off, the daemon preserves today's behavior.

## Failure Modes

| Mode                       | Resolver response                                         | Consumer response                                     |
| -------------------------- | --------------------------------------------------------- | ----------------------------------------------------- |
| cwd not a git repo         | `Err(NotAGitRepo)`                                        | Fall back to minimal metadata                         |
| Bare repository            | `Err(BareRepo)`                                           | Same as non-git                                       |
| Repository with no commits | `Err(NoCommits)`                                          | Same as non-git                                       |
| `git` binary not on PATH   | `Err(GitUnavailable)`                                     | Logged once; resolver becomes a no-op for the session |
| Detached HEAD              | `Ok`, `branch: null`                                      | Store candidate with null branch                      |
| No `origin` remote         | `Ok`, `remoteUrl: null`, tenant falls through to basename | Logged at INFO level                                  |
| Corrupt workspace manifest | Treated as absent; `isMonorepo: false`                    | No impact — the monorepo signal is advisory           |

The resolver never throws. Every error path is a typed `Err`.

## Security Considerations

- Remote URLs in `git config` may contain credentials. Normalization strips them before the URL ever leaves the package; the raw URL is never stored in `RepoContext`.
- The resolver only reads from the filesystem. No writes, no network, no git operations that could mutate state.
- `git` is invoked with `-C <path>` rather than changing cwd, so concurrent resolutions are safe.
- Workspace manifest parsing uses a size cap (64 KB) to defend against pathological files.

## Open Questions Deferred to Implementation

- Whether to surface `submoduleOf` for submodule-aware tenant derivation. Current decision: exclude from v1; the outer repo wins.
- Whether to add a `worktrees: string[]` field. Not needed by current consumers; omit until there is demand.
- Whether to add a pluggable normalization rule set. Default rules are sufficient for github/gitlab/bitbucket hosting. Custom hosts can override via `TEAMKB_TENANT_ID`.

## Testing Strategy

Fixture-based: each test creates a temp dir via `mkdtempSync`, runs `git init` + commits + remote adds as needed, and exercises the resolver against that fixture. Fixtures cover:

- Plain repo with remote
- Plain repo without remote
- Repo with no commits
- Bare repo
- Detached HEAD
- pnpm workspace with a nested workspace package
- npm workspaces
- nx workspace
- Non-git cwd
- Symlinked cwd pointing into a repo

The unit suite runs without network access and completes in under 10 seconds on a laptop. No real remotes are contacted.

## Dependencies on Other Epics

None. repo-resolver depends only on `packages/common` (for `Result<T,E>`) and Node stdlib. All its consumers (claude-runtime, edge-daemon) depend on it.

## Acceptance Criteria for the Epic

- `RepoContext` and `ResolverError` exported from `packages/repo-resolver`.
- `resolveRepoContext(cwd)` returns typed `Result`.
- `deriveTenantId(ctx, overrides?)` honors documented precedence.
- Monorepo detection covers pnpm/npm/yarn/nx/turbo/lerna.
- Process-local cache with TTL and `clearCache()`.
- claude-runtime integrated; non-git cwd does not regress candidate capture.
- Fixture test suite green under `pnpm test`.
- CLAUDE.md updated to remove repo-resolver from the scaffolded list.
