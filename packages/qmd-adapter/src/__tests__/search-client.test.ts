import { describe, it, expect, beforeEach } from 'vitest';
import { MockQmdExecutor } from '../executor/mock-executor.js';
import { SearchClient } from '../search/search-client.js';

describe('SearchClient', () => {
  let mock: MockQmdExecutor;
  let client: SearchClient;

  beforeEach(() => {
    mock = new MockQmdExecutor();
    client = new SearchClient(mock);
  });

  it('executes a search and returns results', async () => {
    mock.queueSuccess('0.95\t/path/kb-curated/doc.md\tSome snippet');
    const result = await client.search('test query');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]!.score).toBe(0.95);
      expect(result.value[0]!.collection).toBe('kb-curated');
    }
  });

  it('defaults scope to curated', async () => {
    // Return results from mixed collections
    mock.queueSuccess('0.9\t/kb-curated/a.md\tA\n0.8\t/kb-inbox/b.md\tB\n0.7\t/kb-guides/c.md\tC');
    const result = await client.search('test');
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Should filter out kb-inbox
      const collections = result.value.map((r) => r.collection);
      expect(collections).not.toContain('kb-inbox');
      expect(collections).toContain('kb-curated');
      expect(collections).toContain('kb-guides');
    }
  });

  it('scope "all" returns everything', async () => {
    mock.queueSuccess('0.9\t/kb-curated/a.md\tA\n0.8\t/kb-inbox/b.md\tB\n0.7\t/kb-archive/c.md\tC');
    const result = await client.search('test', 'all');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(3);
    }
  });

  it('scope "inbox" only returns inbox results', async () => {
    mock.queueSuccess('0.9\t/kb-curated/a.md\tA\n0.8\t/kb-inbox/b.md\tB');
    const result = await client.search('test', 'inbox');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]!.collection).toBe('kb-inbox');
    }
  });

  it('scope "archived" only returns archive results', async () => {
    mock.queueSuccess('0.9\t/kb-curated/a.md\tA\n0.8\t/kb-archive/b.md\tB');
    const result = await client.search('test', 'archived');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]!.collection).toBe('kb-archive');
    }
  });

  it('returns error on command failure', async () => {
    mock.queueFailure('search error', 1);
    const result = await client.search('test');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('command_failed');
    }
  });

  it('handles empty search results', async () => {
    mock.queueSuccess('');
    const result = await client.search('nonexistent');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(0);
    }
  });
});
