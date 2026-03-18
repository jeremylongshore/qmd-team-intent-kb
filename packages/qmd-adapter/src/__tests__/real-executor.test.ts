import { describe, it, expect } from 'vitest';
import { RealQmdExecutor } from '../executor/real-executor.js';

describe('RealQmdExecutor', () => {
  const executor = new RealQmdExecutor();

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

  it('respects dataDir option', () => {
    const exec = new RealQmdExecutor({ dataDir: '/tmp/test-qmd' });
    // Just verify it constructs without error
    expect(exec).toBeDefined();
  });
});
