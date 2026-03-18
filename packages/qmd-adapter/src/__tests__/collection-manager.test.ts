import { describe, it, expect, beforeEach } from 'vitest';
import { MockQmdExecutor } from '../executor/mock-executor.js';
import { CollectionManager } from '../collections/collection-manager.js';

describe('CollectionManager', () => {
  let mock: MockQmdExecutor;
  let manager: CollectionManager;

  beforeEach(() => {
    mock = new MockQmdExecutor();
    manager = new CollectionManager(mock, '/tmp/test-data');
  });

  describe('addCollection', () => {
    it('adds a collection successfully', async () => {
      mock.queueSuccess('');
      const result = await manager.addCollection('kb-curated', '/path/to/docs');
      expect(result.ok).toBe(true);
      expect(mock.lastCommand).toEqual([
        'collection',
        'add',
        '/path/to/docs',
        '--name',
        'kb-curated',
      ]);
    });

    it('returns error on failure', async () => {
      mock.queueFailure('already exists');
      const result = await manager.addCollection('kb-curated', '/path');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('command_failed');
      }
    });
  });

  describe('removeCollection', () => {
    it('removes a collection', async () => {
      mock.queueSuccess('');
      const result = await manager.removeCollection('kb-inbox');
      expect(result.ok).toBe(true);
      expect(mock.lastCommand).toEqual(['collection', 'remove', 'kb-inbox']);
    });
  });

  describe('listCollections', () => {
    it('lists collections', async () => {
      mock.queueSuccess('kb-curated\nkb-guides\nkb-inbox');
      const result = await manager.listCollections();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(['kb-curated', 'kb-guides', 'kb-inbox']);
      }
    });

    it('handles empty list', async () => {
      mock.queueSuccess('');
      const result = await manager.listCollections();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([]);
      }
    });
  });

  describe('ensureCollections', () => {
    it('creates missing collections', async () => {
      // listCollections returns empty
      mock.queueSuccess('');
      // 5 addCollection calls
      for (let i = 0; i < 5; i++) {
        mock.queueSuccess('');
      }
      const result = await manager.ensureCollections('/base/path');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(5);
      }
    });

    it('skips existing collections', async () => {
      // listCollections returns all 5
      mock.queueSuccess('kb-curated\nkb-decisions\nkb-guides\nkb-inbox\nkb-archive');
      const result = await manager.ensureCollections('/base/path');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(0);
      }
    });
  });
});
