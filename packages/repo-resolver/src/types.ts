import { z } from 'zod';

/**
 * Resolved context for a git working tree.
 *
 * See 000-docs/026-AT-DSGN-repo-resolver-design.md for field semantics.
 * Defined as a Zod schema with the TypeScript type derived via `z.infer<>`,
 * matching the project convention from `packages/schema`.
 */
export const RepoContext = z.object({
  /** Absolute path to the repo working tree root. */
  repoRoot: z.string().min(1),
  /** Lowercased basename of `repoRoot`. */
  repoName: z.string().min(1),
  /** Origin remote URL, or null when no origin is configured. */
  remoteUrl: z.string().nullable(),
  /** Current branch, or null when HEAD is detached. */
  branch: z.string().nullable(),
  /** HEAD commit SHA (40-char hex). */
  commitSha: z.string().regex(/^[0-9a-f]{40}$/),
  /** True when a workspace manifest was detected. */
  isMonorepo: z.boolean(),
  /** Monorepo root (may equal `repoRoot`), or null when not a monorepo. */
  workspaceRoot: z.string().nullable(),
  /** Workspace package `name` containing `cwd`, or null. */
  workspacePackage: z.string().nullable(),
});
export type RepoContext = z.infer<typeof RepoContext>;

/**
 * Typed failure modes. The resolver never throws — every failure path
 * returns `Err<ResolverError>`.
 */
export const ResolverError = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('NotAGitRepo'), cwd: z.string() }),
  z.object({ kind: z.literal('BareRepo'), repoRoot: z.string() }),
  z.object({ kind: z.literal('NoCommits'), repoRoot: z.string() }),
  z.object({ kind: z.literal('GitUnavailable'), cause: z.string() }),
  z.object({ kind: z.literal('Io'), path: z.string(), cause: z.string() }),
]);
export type ResolverError = z.infer<typeof ResolverError>;
