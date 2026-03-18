import { describe, it, expect, beforeEach } from 'vitest';
import { MockQmdExecutor } from '../executor/mock-executor.js';
import { checkHealth } from '../health/health-check.js';

describe('checkHealth', () => {
  let mock: MockQmdExecutor;

  beforeEach(() => {
    mock = new MockQmdExecutor();
  });

  it('reports not available when qmd is missing', async () => {
    mock.setAvailable(false);
    const status = await checkHealth(mock);
    expect(status.available).toBe(false);
    expect(status.version).toBeNull();
    expect(status.initialized).toBe(false);
    expect(status.collections).toEqual([]);
  });

  it('reports available and initialized with collections', async () => {
    mock.queueSuccess('qmd 2.0.1'); // --version
    mock.queueSuccess('kb-curated\nkb-guides'); // collection list
    const status = await checkHealth(mock);
    expect(status.available).toBe(true);
    expect(status.version).toBe('qmd 2.0.1');
    expect(status.initialized).toBe(true);
    expect(status.collections).toEqual(['kb-curated', 'kb-guides']);
  });

  it('reports available but not initialized (no collections)', async () => {
    mock.queueSuccess('qmd 2.0.1'); // --version
    mock.queueSuccess(''); // collection list (empty)
    const status = await checkHealth(mock);
    expect(status.available).toBe(true);
    expect(status.initialized).toBe(false);
    expect(status.collections).toEqual([]);
  });

  it('never throws', async () => {
    // Even with weird state, should not throw
    mock.setAvailable(true);
    // No responses queued — both --version and collection list will "fail"
    const status = await checkHealth(mock);
    expect(status.available).toBe(true);
    // version and collections may be null/empty but no throw
    expect(typeof status.initialized).toBe('boolean');
  });
});
