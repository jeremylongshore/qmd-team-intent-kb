import { afterEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { realpathSync } from 'node:fs';
import { RepoContextCache, clearCache, getDefaultCache, setCacheTtl } from '../cache.js';
import { resolveRepoContext } from '../resolver.js';
import { makeRepoWithRemote, type Fixture } from './fixtures.js';
import type { RepoContext } from '../types.js';

function fakeContext(repoRoot: string, commitSha = '0'.repeat(40)): RepoContext {
  return {
    repoRoot,
    repoName: 'fake',
    remoteUrl: null,
    branch: null,
    commitSha,
    isMonorepo: false,
    workspaceRoot: null,
    workspacePackage: null,
  };
}

describe('RepoContextCache', () => {
  it('returns null when an entry is absent', () => {
    const c = new RepoContextCache();
    expect(c.getByCwd('/x')).toBeNull();
    expect(c.getByRoot('/x')).toBeNull();
  });

  it('round-trips by cwd and by root', () => {
    const c = new RepoContextCache();
    const ctx = fakeContext('/r');
    c.set('/cwd', ctx);
    expect(c.getByCwd('/cwd')).toBe(ctx);
    expect(c.getByRoot('/r')).toBe(ctx);
  });

  it('shares a single entry across multiple cwd values pointing at one repo', () => {
    const c = new RepoContextCache();
    const ctx = fakeContext('/r');
    c.set('/r/sub/a', ctx);
    c.set('/r/sub/b', ctx);
    expect(c.size()).toBe(1);
    expect(c.getByCwd('/r/sub/a')).toBe(ctx);
    expect(c.getByCwd('/r/sub/b')).toBe(ctx);
  });

  it('expires entries past TTL and evicts on access', () => {
    let now = 1000;
    const c = new RepoContextCache({ ttlMs: 100, nowFn: () => now });
    c.set('/cwd', fakeContext('/r'));
    expect(c.getByCwd('/cwd')).not.toBeNull();
    now = 1101;
    expect(c.getByCwd('/cwd')).toBeNull();
    expect(c.size()).toBe(0);
  });

  it('clear() drops all entries and cwd index', () => {
    const c = new RepoContextCache();
    c.set('/cwd', fakeContext('/r'));
    c.clear();
    expect(c.size()).toBe(0);
    expect(c.getByCwd('/cwd')).toBeNull();
  });

  it('setTtl changes future expiry decisions', () => {
    let now = 1000;
    const c = new RepoContextCache({ ttlMs: 1_000_000, nowFn: () => now });
    c.set('/cwd', fakeContext('/r'));
    c.setTtl(50);
    now = 1100;
    expect(c.getByCwd('/cwd')).toBeNull();
  });
});

describe('resolveRepoContext + cache integration', () => {
  const fixtures: Fixture[] = [];
  function track<T extends Fixture>(fx: T): T {
    fixtures.push(fx);
    return fx;
  }
  afterEach(() => {
    while (fixtures.length > 0) fixtures.pop()?.cleanup();
    clearCache();
  });

  it('second call hits the cache (same RepoContext reference)', async () => {
    clearCache();
    const fx = track(makeRepoWithRemote());
    const first = await resolveRepoContext(fx.dir);
    const second = await resolveRepoContext(fx.dir);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value).toBe(first.value);
  });

  it('explicit null cache disables caching', async () => {
    clearCache();
    const fx = track(makeRepoWithRemote());
    const first = await resolveRepoContext(fx.dir, { cache: null });
    const second = await resolveRepoContext(fx.dir, { cache: null });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value).not.toBe(first.value);
    // Default cache must remain empty when cache:null was passed.
    expect(getDefaultCache().getByCwd(realpathSync(fx.dir))).toBeNull();
  });

  it('clearCache() forces a fresh resolution', async () => {
    clearCache();
    const fx = track(makeRepoWithRemote());
    const first = await resolveRepoContext(fx.dir);
    clearCache();
    const second = await resolveRepoContext(fx.dir);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value).not.toBe(first.value);
  });

  it('expired entries are bypassed and refreshed', async () => {
    clearCache();
    setCacheTtl(0);
    const fx = track(makeRepoWithRemote());
    const first = await resolveRepoContext(fx.dir);
    const second = await resolveRepoContext(fx.dir);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value).not.toBe(first.value);
    setCacheTtl(5 * 60 * 1000);
  });

  it('different cwd in the same repo shares a single cached entry', async () => {
    clearCache();
    const fx = track(makeRepoWithRemote());
    // Resolve from the repo root, then from the same path again — the
    // cwd index must avoid a re-resolution.
    const root = realpathSync(fx.dir);
    const a = await resolveRepoContext(fx.dir);
    const b = await resolveRepoContext(root);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(b.value).toBe(a.value);
    expect(getDefaultCache().size()).toBe(1);
  });

  it('Io errors are not cached', async () => {
    clearCache();
    const before = getDefaultCache().size();
    const result = await resolveRepoContext(join('/definitely', 'not', 'here'));
    expect(result.ok).toBe(false);
    expect(getDefaultCache().size()).toBe(before);
  });
});
