/**
 * Resolved context for a git working tree.
 *
 * See 000-docs/026-AT-DSGN-repo-resolver-design.md for field semantics.
 * Monorepo fields (`isMonorepo`, `workspaceRoot`, `workspacePackage`) are
 * populated by the monorepo detection pass (mbd.3); the core resolver
 * leaves them at their "not a monorepo" defaults.
 */
export interface RepoContext {
  /** Absolute path to the repo working tree root. */
  repoRoot: string;
  /** Lowercased basename of `repoRoot`. */
  repoName: string;
  /** Origin remote URL, or null when no origin is configured. */
  remoteUrl: string | null;
  /** Current branch, or null when HEAD is detached. */
  branch: string | null;
  /** HEAD commit SHA (40-char hex). */
  commitSha: string;
  /** True when a workspace manifest was detected. */
  isMonorepo: boolean;
  /** Monorepo root (may equal `repoRoot`), or null when not a monorepo. */
  workspaceRoot: string | null;
  /** Workspace package `name` containing `cwd`, or null. */
  workspacePackage: string | null;
}

/**
 * Typed failure modes. The resolver never throws — every failure path
 * returns `Err<ResolverError>`.
 */
export type ResolverError =
  | { kind: 'NotAGitRepo'; cwd: string }
  | { kind: 'BareRepo'; repoRoot: string }
  | { kind: 'NoCommits'; repoRoot: string }
  | { kind: 'GitUnavailable'; cause: string }
  | { kind: 'Io'; path: string; cause: string };
