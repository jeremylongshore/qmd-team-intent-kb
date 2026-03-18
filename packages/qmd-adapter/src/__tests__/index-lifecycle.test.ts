import { describe, it, expect, beforeEach } from 'vitest';
import { MockQmdExecutor } from '../executor/mock-executor.js';
import { IndexLifecycleManager } from '../index-manager/index-lifecycle.js';

describe('IndexLifecycleManager', () => {
  let mock: MockQmdExecutor;
  let manager: IndexLifecycleManager;

  beforeEach(() => {
    mock = new MockQmdExecutor();
    manager = new IndexLifecycleManager(mock);
  });

  describe('update', () => {
    it('runs qmd update', async () => {
      mock.queueSuccess('Updated 5 files');
      const result = await manager.update();
      expect(result.ok).toBe(true);
      expect(mock.lastCommand).toEqual(['update']);
    });

    it('returns error on failure', async () => {
      mock.queueFailure('No collections found');
      const result = await manager.update();
      expect(result.ok).toBe(false);
    });
  });

  describe('embed', () => {
    it('runs qmd embed', async () => {
      mock.queueSuccess('Embedded 10 documents');
      const result = await manager.embed();
      expect(result.ok).toBe(true);
      expect(mock.lastCommand).toEqual(['embed']);
    });

    it('runs qmd embed -f when forced', async () => {
      mock.queueSuccess('');
      const result = await manager.embed(true);
      expect(result.ok).toBe(true);
      expect(mock.lastCommand).toEqual(['embed', '-f']);
    });
  });

  describe('cleanup', () => {
    it('runs qmd cleanup', async () => {
      mock.queueSuccess('Cleaned up');
      const result = await manager.cleanup();
      expect(result.ok).toBe(true);
      expect(mock.lastCommand).toEqual(['cleanup']);
    });
  });

  describe('status', () => {
    it('returns status output', async () => {
      mock.queueSuccess('Index: 42 documents, 3 collections');
      const result = await manager.status();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('42 documents');
      }
    });
  });
});
