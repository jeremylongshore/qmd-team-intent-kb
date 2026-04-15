/**
 * Fixture-based integration tests for resolveRepoContext.
 *
 * Each test builds a real git repository in a mkdtempSync directory, runs the
 * resolver, and asserts the outcome. Fixtures are torn down after each test.
 *
 * Bead: qmd-team-intent-kb-mbd.7
 */
import { afterEach, describe, expect, it } from 'vitest';
import { realpathSync } from 'node:fs';
import { basename } from 'node:path';
import { resolveRepoContext } from '../resolver.js';
import {
  makeBareRepo,
  makeNonGitDir,
  makeNxWorkspace,
  makeRepoDetached,
  makeRepoNoRemote,
  makeRepoWithPnpmWorkspace,
  makeRepoWithRemote,
  makeRepoWithSubmodule,
  makeRepoWithWorktree,
  type Fixture,
} from './fixtures.js';

// ---------------------------------------------------------------------------
// Fixture tracking — all fixtures registered here are cleaned up afterEach.
// ---------------------------------------------------------------------------

const fixtures: Fixture[] = [];

function track<T extends Fixture>(fx: T): T {
  fixtures.push(fx);
  return fx;
}

afterEach(() => {
  while (fixtures.length > 0) {
    fixtures.pop()?.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Fixture 1: Plain repo — single git repo, single remote, normal branch
// ---------------------------------------------------------------------------

describe('fixture 1: plain repo with remote and branch', () => {
  it('resolves repoRoot, repoName, remoteUrl, branch, and commitSha', async () => {
    const fx = track(makeRepoWithRemote());
    const result = await resolveRepoContext(fx.dir, { cache: null });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ctx = result.value;
    expect(ctx.repoRoot).toBe(realpathSync(fx.dir));
    expect(ctx.repoName).toBe(basename(realpathSync(fx.dir)).toLowerCase());
    expect(ctx.remoteUrl).toBe('https://github.com/acme/widget.git');
    expect(ctx.branch).toBe('main');
    expect(ctx.commitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(ctx.isMonorepo).toBe(false);
    expect(ctx.workspaceRoot).toBeNull();
    expect(ctx.workspacePackage).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Fixture 2: pnpm workspace with nested package — invoke from packages/foo
// ---------------------------------------------------------------------------

describe('fixture 2: pnpm workspace with nested package', () => {
  it('detects isMonorepo=true and workspacePackage when invoked from inner package', async () => {
    const fx = track(makeRepoWithPnpmWorkspace());
    const result = await resolveRepoContext(fx.innerDir, { cache: null });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ctx = result.value;
    expect(ctx.isMonorepo).toBe(true);
    expect(ctx.workspaceRoot).toBe(realpathSync(fx.dir));
    expect(ctx.workspacePackage).toBe('@scope/inner');
    // repoRoot still points at the git root, not the inner package.
    expect(ctx.repoRoot).toBe(realpathSync(fx.dir));
  });

  it('detects isMonorepo=true with null workspacePackage when invoked from workspace root', async () => {
    const fx = track(makeRepoWithPnpmWorkspace());
    const result = await resolveRepoContext(fx.dir, { cache: null });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ctx = result.value;
    expect(ctx.isMonorepo).toBe(true);
    expect(ctx.workspaceRoot).toBe(realpathSync(fx.dir));
    // cwd === workspaceRoot so workspacePackage must be null.
    expect(ctx.workspacePackage).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Fixture 3: nx workspace — nx.json at root + packages/* layout
// ---------------------------------------------------------------------------

describe('fixture 3: nx workspace', () => {
  it('detects isMonorepo=true when invoked from inside packages/foo', async () => {
    const fx = track(makeNxWorkspace());
    const result = await resolveRepoContext(fx.innerDir, { cache: null });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ctx = result.value;
    expect(ctx.isMonorepo).toBe(true);
    expect(ctx.workspaceRoot).toBe(realpathSync(fx.dir));
    expect(ctx.workspacePackage).toBe('@nx-scope/foo');
  });

  it('detects isMonorepo=true with null workspacePackage when at nx root', async () => {
    const fx = track(makeNxWorkspace());
    const result = await resolveRepoContext(fx.dir, { cache: null });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ctx = result.value;
    expect(ctx.isMonorepo).toBe(true);
    expect(ctx.workspaceRoot).toBe(realpathSync(fx.dir));
    expect(ctx.workspacePackage).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Fixture 4: Detached HEAD — repo checked out at a commit (no branch)
// ---------------------------------------------------------------------------

describe('fixture 4: detached HEAD', () => {
  it('succeeds with branch=null and a valid commitSha', async () => {
    const fx = track(makeRepoDetached());
    const result = await resolveRepoContext(fx.dir, { cache: null });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ctx = result.value;
    expect(ctx.branch).toBeNull();
    expect(ctx.commitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(ctx.repoRoot).toBe(realpathSync(fx.dir));
  });
});

// ---------------------------------------------------------------------------
// Fixture 5: Bare repo — git init --bare (no working tree)
// ---------------------------------------------------------------------------

describe('fixture 5: bare repo', () => {
  it('returns a BareRepo error', async () => {
    const fx = track(makeBareRepo());
    const result = await resolveRepoContext(fx.dir, { cache: null });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('BareRepo');
  });
});

// ---------------------------------------------------------------------------
// Fixture 6: Non-git cwd — mkdtempSync outside any git repo
// ---------------------------------------------------------------------------

describe('fixture 6: non-git directory', () => {
  it('returns a NotAGitRepo error with the canonical cwd', async () => {
    const fx = track(makeNonGitDir());
    const result = await resolveRepoContext(fx.dir, { cache: null });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('NotAGitRepo');
    // The error must carry the canonical cwd so callers can surface it.
    // Guard the discriminated-union narrowing so TypeScript knows we have
    // a NotAGitRepo variant before accessing `.cwd`.
    if (result.error.kind !== 'NotAGitRepo') return;
    expect(result.error.cwd).toBe(realpathSync(fx.dir));
  });
});

// ---------------------------------------------------------------------------
// Fixture 7: Submodule — repo with a submodule, invoked from inside it
// ---------------------------------------------------------------------------

describe('fixture 7: git submodule', () => {
  it('resolves successfully when invoked from inside the submodule working tree', async () => {
    const fx = track(makeRepoWithSubmodule());
    const result = await resolveRepoContext(fx.submoduleDir, { cache: null });

    // The submodule directory is a valid git working tree — the resolver
    // should succeed and report its own repoRoot (the submodule root, not
    // the parent repo root).
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ctx = result.value;
    expect(ctx.repoRoot).toBe(realpathSync(fx.submoduleDir));
    expect(ctx.commitSha).toMatch(/^[0-9a-f]{40}$/);
  });

  it('resolves the parent repo when invoked from the parent working tree root', async () => {
    const fx = track(makeRepoWithSubmodule());
    const result = await resolveRepoContext(fx.dir, { cache: null });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.repoRoot).toBe(realpathSync(fx.dir));
  });
});

// ---------------------------------------------------------------------------
// Fixture 8: Git worktree — invoke from the linked worktree
// ---------------------------------------------------------------------------

describe('fixture 8: git worktree', () => {
  it('resolves from a linked worktree with correct branch and repoRoot', async () => {
    const fx = track(makeRepoWithWorktree());
    const result = await resolveRepoContext(fx.worktreeDir, { cache: null });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ctx = result.value;
    // The worktree's repoRoot resolves to the linked worktree directory itself.
    expect(ctx.repoRoot).toBe(realpathSync(fx.worktreeDir));
    expect(ctx.branch).toBe('wt-branch');
    expect(ctx.commitSha).toMatch(/^[0-9a-f]{40}$/);
  });

  it('resolves from the primary working tree independently', async () => {
    const fx = track(makeRepoWithWorktree());
    const resultPrimary = await resolveRepoContext(fx.dir, { cache: null });
    const resultLinked = await resolveRepoContext(fx.worktreeDir, { cache: null });

    expect(resultPrimary.ok).toBe(true);
    expect(resultLinked.ok).toBe(true);
    if (!resultPrimary.ok || !resultLinked.ok) return;

    // Each worktree has its own branch.
    expect(resultPrimary.value.branch).toBe('main');
    expect(resultLinked.value.branch).toBe('wt-branch');
    // repoRoots differ (each worktree has its own working tree root).
    expect(resultPrimary.value.repoRoot).not.toBe(resultLinked.value.repoRoot);
  });
});

// ---------------------------------------------------------------------------
// Fixture 9: No remote configured — git init without git remote add
// ---------------------------------------------------------------------------

describe('fixture 9: no remote configured', () => {
  it('resolves successfully with remoteUrl=null', async () => {
    const fx = track(makeRepoNoRemote());
    const result = await resolveRepoContext(fx.dir, { cache: null });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ctx = result.value;
    expect(ctx.remoteUrl).toBeNull();
    expect(ctx.branch).toBe('main');
    expect(ctx.commitSha).toMatch(/^[0-9a-f]{40}$/);
  });
});
