import { describe, it, expect, afterEach } from 'vitest';
import { getTenantDataDir, getCollectionDataDir } from '../index-manager/index-paths.js';

describe('index-paths', () => {
  const originalEnv = process.env['TEAMKB_BASE_PATH'];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env['TEAMKB_BASE_PATH'];
    } else {
      process.env['TEAMKB_BASE_PATH'] = originalEnv;
    }
  });

  it('getTenantDataDir returns tenant-scoped path', () => {
    process.env['TEAMKB_BASE_PATH'] = '/test';
    expect(getTenantDataDir('my-tenant')).toBe('/test/qmd-index/my-tenant');
  });

  it('getCollectionDataDir returns collection-scoped path', () => {
    process.env['TEAMKB_BASE_PATH'] = '/test';
    expect(getCollectionDataDir('my-tenant', 'kb-curated')).toBe(
      '/test/qmd-index/my-tenant/kb-curated',
    );
  });
});
