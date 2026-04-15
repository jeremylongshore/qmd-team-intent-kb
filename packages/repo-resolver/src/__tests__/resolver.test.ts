import { afterEach, describe, expect, it } from 'vitest';
import { basename } from 'node:path';
import { realpathSync } from 'node:fs';
import { resolveRepoContext } from '../resolver.js';
import {
  makeBareRepo,
  makeNonGitDir,
  makeRepoDetached,
  makeRepoNoCommits,
  makeRepoNoRemote,
  makeRepoWithPnpmWorkspace,
  makeRepoWithRemote,
  type Fixture,
} from './fixtures.js';

describe('resolveRepoContext', () => {
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

  it('resolves a plain repo with remote and initial commit', async () => {
    const fx = track(makeRepoWithRemote());
    const result = await resolveRepoContext(fx.dir);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ctx = result.value;
    expect(ctx.repoRoot).toBe(realpathSync(fx.dir));
    expect(ctx.repoName).toBe(basename(fx.dir).toLowerCase());
    expect(ctx.remoteUrl).toBe('https://github.com/acme/widget.git');
    expect(ctx.branch).toBe('main');
    expect(ctx.commitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(ctx.isMonorepo).toBe(false);
    expect(ctx.workspaceRoot).toBeNull();
    expect(ctx.workspacePackage).toBeNull();
  });

  it('returns remoteUrl=null when no origin is configured', async () => {
    const fx = track(makeRepoNoRemote());
    const result = await resolveRepoContext(fx.dir);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.remoteUrl).toBeNull();
    expect(result.value.branch).toBe('main');
  });

  it('returns branch=null for detached HEAD', async () => {
    const fx = track(makeRepoDetached());
    const result = await resolveRepoContext(fx.dir);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.branch).toBeNull();
    expect(result.value.commitSha).toMatch(/^[0-9a-f]{40}$/);
  });

  it('returns NotAGitRepo for a non-git directory', async () => {
    const fx = track(makeNonGitDir());
    const result = await resolveRepoContext(fx.dir);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('NotAGitRepo');
  });

  it('returns BareRepo for a bare repository', async () => {
    const fx = track(makeBareRepo());
    const result = await resolveRepoContext(fx.dir);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('BareRepo');
  });

  it('returns NoCommits when the repo has no HEAD', async () => {
    const fx = track(makeRepoNoCommits());
    const result = await resolveRepoContext(fx.dir);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('NoCommits');
  });

  it('returns Io error for a path that does not exist', async () => {
    const result = await resolveRepoContext('/definitely/does/not/exist/anywhere');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('Io');
  });

  it('canonicalizes cwd via realpath', async () => {
    const fx = track(makeRepoWithRemote());
    const result = await resolveRepoContext(fx.dir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // On macOS /tmp is a symlink; realpath must have resolved it.
    expect(result.value.repoRoot).toBe(realpathSync(fx.dir));
  });

  it('populates monorepo fields when cwd is inside a pnpm workspace package', async () => {
    const fx = track(makeRepoWithPnpmWorkspace());
    const result = await resolveRepoContext(fx.innerDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.isMonorepo).toBe(true);
    expect(result.value.workspaceRoot).toBe(realpathSync(fx.dir));
    expect(result.value.workspacePackage).toBe('@scope/inner');
  });

  it('populates workspaceRoot but null workspacePackage when cwd is at repo root', async () => {
    const fx = track(makeRepoWithPnpmWorkspace());
    const result = await resolveRepoContext(fx.dir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.isMonorepo).toBe(true);
    expect(result.value.workspaceRoot).toBe(realpathSync(fx.dir));
    // Root package.json has name='root' but cwd === workspaceRoot, so null.
    expect(result.value.workspacePackage).toBeNull();
  });
});
