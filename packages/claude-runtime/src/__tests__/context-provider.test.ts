import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import type { Result } from '@qmd-team-intent-kb/common';
import type { RepoContext, ResolverError } from '@qmd-team-intent-kb/repo-resolver';

vi.mock('@qmd-team-intent-kb/repo-resolver', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...(mod as object),
    resolveRepoContext: vi.fn(),
  };
});

vi.mock('../capture/git-context.js', () => ({
  resolveGitContext: vi.fn(),
}));

import { resolveRepoContext } from '@qmd-team-intent-kb/repo-resolver';
import { resolveGitContext } from '../capture/git-context.js';
import { DefaultContextProvider } from '../capture/context-provider.js';

const mockResolveRepoContext = resolveRepoContext as Mock;
const mockResolveGitContext = resolveGitContext as Mock;

const makeRepoContext = (overrides?: Partial<RepoContext>): RepoContext => ({
  repoRoot: '/home/user/projects/my-repo',
  repoName: 'my-repo',
  remoteUrl: 'https://github.com/acme/my-repo.git',
  branch: 'main',
  commitSha: 'a'.repeat(40),
  isMonorepo: false,
  workspaceRoot: null,
  workspacePackage: null,
  ...overrides,
});

const okResult = (ctx: RepoContext): Result<RepoContext, ResolverError> => ({
  ok: true,
  value: ctx,
});

const errResult = (error: ResolverError): Result<RepoContext, ResolverError> => ({
  ok: false,
  error,
});

describe('DefaultContextProvider', () => {
  let provider: DefaultContextProvider;

  beforeEach(() => {
    provider = new DefaultContextProvider();
    mockResolveRepoContext.mockReset();
    mockResolveGitContext.mockReset();
  });

  it('returns enriched GitContext from repo-resolver on success', async () => {
    const ctx = makeRepoContext();
    mockResolveRepoContext.mockResolvedValue(okResult(ctx));

    const result = await provider.resolveGitContext('/some/cwd');

    expect(result).not.toBeNull();
    expect(result?.repoName).toBe('my-repo');
    expect(result?.commitSha).toBe('a'.repeat(40));
    expect(result?.branch).toBe('main');
    expect(result?.repoUrl).toBe('https://github.com/acme/my-repo.git');
  });

  it('derives tenantId from repo-resolver context', async () => {
    const ctx = makeRepoContext({ remoteUrl: 'https://github.com/acme/my-repo.git' });
    mockResolveRepoContext.mockResolvedValue(okResult(ctx));

    const result = await provider.resolveGitContext('/some/cwd');

    expect(result?.tenantId).toBe('github.com/acme/my-repo');
  });

  it('falls back to legacy resolveGitContext when resolver returns NotAGitRepo', async () => {
    mockResolveRepoContext.mockResolvedValue(errResult({ kind: 'NotAGitRepo', cwd: '/some/cwd' }));
    mockResolveGitContext.mockResolvedValue({
      repoUrl: 'https://github.com/fallback/repo.git',
      branch: 'develop',
      userName: 'dev',
      tenantId: 'fallback-repo',
    });

    const result = await provider.resolveGitContext('/some/cwd');

    expect(mockResolveGitContext).toHaveBeenCalledWith('/some/cwd');
    expect(result?.tenantId).toBe('fallback-repo');
    expect(result?.branch).toBe('develop');
  });

  it('falls back when resolver returns GitUnavailable', async () => {
    mockResolveRepoContext.mockResolvedValue(
      errResult({ kind: 'GitUnavailable', cause: 'git not found' }),
    );
    mockResolveGitContext.mockResolvedValue(null);

    const result = await provider.resolveGitContext('/some/cwd');

    expect(mockResolveGitContext).toHaveBeenCalledWith('/some/cwd');
    expect(result).toBeNull();
  });

  it('falls back when resolver returns NoCommits', async () => {
    mockResolveRepoContext.mockResolvedValue(
      errResult({ kind: 'NoCommits', repoRoot: '/some/cwd' }),
    );
    mockResolveGitContext.mockResolvedValue(null);

    const result = await provider.resolveGitContext('/some/cwd');

    expect(mockResolveGitContext).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
  });

  it('enriched result has no repoName/commitSha on fallback path', async () => {
    mockResolveRepoContext.mockResolvedValue(errResult({ kind: 'NotAGitRepo', cwd: '/some/cwd' }));
    mockResolveGitContext.mockResolvedValue({
      repoUrl: 'https://github.com/org/repo.git',
      branch: 'main',
      userName: 'user',
      tenantId: 'org-repo',
    });

    const result = await provider.resolveGitContext('/some/cwd');

    expect(result?.repoName).toBeUndefined();
    expect(result?.commitSha).toBeUndefined();
  });

  it('handles detached HEAD (null branch) from resolver', async () => {
    const ctx = makeRepoContext({ branch: null });
    mockResolveRepoContext.mockResolvedValue(okResult(ctx));

    const result = await provider.resolveGitContext('/some/cwd');

    expect(result?.branch).toBe('unknown');
  });

  it('handles no remote URL (null remoteUrl) from resolver', async () => {
    const ctx = makeRepoContext({ remoteUrl: null });
    mockResolveRepoContext.mockResolvedValue(okResult(ctx));

    const result = await provider.resolveGitContext('/some/cwd');

    expect(result?.repoUrl).toBe('');
  });

  it('uses process.cwd() when no cwd argument given', async () => {
    const ctx = makeRepoContext();
    mockResolveRepoContext.mockResolvedValue(okResult(ctx));

    await provider.resolveGitContext();

    expect(mockResolveRepoContext).toHaveBeenCalledWith(process.cwd());
  });
});
