import { describe, it, expect, beforeEach } from 'vitest';
import { MockQmdExecutor } from '../executor/mock-executor.js';
import { QmdAdapter } from '../adapter.js';

describe('QmdAdapter', () => {
  let mock: MockQmdExecutor;
  let adapter: QmdAdapter;

  beforeEach(() => {
    mock = new MockQmdExecutor();
    adapter = new QmdAdapter({ tenantId: 'test-tenant' }, mock);
  });

  it('delegates query to search client', async () => {
    mock.queueSuccess('0.9\t/kb-curated/doc.md\tResult snippet');
    const result = await adapter.query('test query');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
    }
  });

  it('delegates health to checkHealth', async () => {
    mock.queueSuccess('qmd 2.0.1');
    mock.queueSuccess('kb-curated');
    const status = await adapter.health();
    expect(status.available).toBe(true);
  });

  it('delegates update to index lifecycle', async () => {
    mock.queueSuccess('Updated');
    const result = await adapter.update();
    expect(result.ok).toBe(true);
  });

  it('delegates ensureCollections to collection manager', async () => {
    mock.queueSuccess(''); // list
    for (let i = 0; i < 5; i++) mock.queueSuccess(''); // adds
    const result = await adapter.ensureCollections();
    expect(result.ok).toBe(true);
  });

  it('enforces curated-only default on query', async () => {
    mock.queueSuccess('0.9\t/kb-curated/a.md\tA\n0.8\t/kb-inbox/b.md\tB');
    const result = await adapter.query('test');
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Should not include inbox results
      expect(result.value.some((r) => r.collection === 'kb-inbox')).toBe(false);
    }
  });
});
