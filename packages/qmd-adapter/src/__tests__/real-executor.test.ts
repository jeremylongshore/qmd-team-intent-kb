import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { RealQmdExecutor } from '../executor/real-executor.js';

function isQmdAvailable(): boolean {
  try {
    execSync('which qmd', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const qmdAvailable = isQmdAvailable();

describe('RealQmdExecutor', () => {
  const executor = new RealQmdExecutor();

  it('respects dataDir option', () => {
    const exec = new RealQmdExecutor({ dataDir: '/tmp/test-qmd' });
    expect(exec).toBeDefined();
  });

  describe.skipIf(!qmdAvailable)('with qmd binary', () => {
    it('detects qmd availability', async () => {
      const available = await executor.isAvailable();
      expect(available).toBe(true);
    });

    it('gets qmd version', async () => {
      const result = await executor.execute(['--version']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('qmd');
    });

    it('handles invalid commands gracefully', async () => {
      const result = await executor.execute(['invalid-command-that-does-not-exist']);
      expect(result.exitCode).not.toBe(0);
    });
  });
});
