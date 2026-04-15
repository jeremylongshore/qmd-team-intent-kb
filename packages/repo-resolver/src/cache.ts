import type { RepoContext } from './types.js';

/**
 * Process-local cache for resolved RepoContext objects.
 *
 * Two-level lookup: realpath(cwd) → repoRoot → { context, fetchedAt }.
 * The cwd indirection lets resolutions from any subdirectory share a single
 * entry per repo. Entries expire after `ttlMs`.
 *
 * See 000-docs/026-AT-DSGN-repo-resolver-design.md.
 */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  context: RepoContext;
  fetchedAt: number;
}

export class RepoContextCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly cwdIndex = new Map<string, string>();
  private ttlMs: number;
  private readonly nowFn: () => number;

  constructor(opts: { ttlMs?: number; nowFn?: () => number } = {}) {
    this.ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
    this.nowFn = opts.nowFn ?? Date.now;
  }

  /**
   * Look up by canonical cwd. Returns the cached context only when both the
   * cwd→repoRoot mapping exists AND the entry is still within TTL. Stale
   * entries are evicted on access.
   */
  getByCwd(canonicalCwd: string): RepoContext | null {
    const repoRoot = this.cwdIndex.get(canonicalCwd);
    if (!repoRoot) return null;
    return this.getByRoot(repoRoot);
  }

  /** Look up by repoRoot. Stale entries are evicted on access. */
  getByRoot(repoRoot: string): RepoContext | null {
    const entry = this.entries.get(repoRoot);
    if (!entry) return null;
    if (this.nowFn() - entry.fetchedAt >= this.ttlMs) {
      this.entries.delete(repoRoot);
      return null;
    }
    return entry.context;
  }

  /**
   * Insert a freshly resolved context. Records both the cwd→repoRoot
   * mapping and the repoRoot→entry mapping.
   */
  set(canonicalCwd: string, context: RepoContext): void {
    this.cwdIndex.set(canonicalCwd, context.repoRoot);
    this.entries.set(context.repoRoot, {
      context,
      fetchedAt: this.nowFn(),
    });
  }

  /** Drop everything. For tests and explicit invalidation. */
  clear(): void {
    this.entries.clear();
    this.cwdIndex.clear();
  }

  /** Replace the TTL. Existing entries keep their original fetchedAt. */
  setTtl(ttlMs: number): void {
    this.ttlMs = ttlMs;
  }

  /** Test introspection. */
  size(): number {
    return this.entries.size;
  }
}

let defaultCache = new RepoContextCache();

export function getDefaultCache(): RepoContextCache {
  return defaultCache;
}

/** Reset the default singleton. Tests should call this between cases. */
export function clearCache(): void {
  defaultCache.clear();
}

/** Configure the default singleton's TTL. */
export function setCacheTtl(ttlMs: number): void {
  defaultCache.setTtl(ttlMs);
}

/** Replace the default cache (advanced — primarily for tests injecting nowFn). */
export function setDefaultCache(cache: RepoContextCache): void {
  defaultCache = cache;
}
