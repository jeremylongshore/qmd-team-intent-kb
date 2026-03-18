import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeToFailureBucket } from '../spool/failure-bucket.js';

describe('writeToFailureBucket', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'failed-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('writes a failure record', async () => {
    const result = await writeToFailureBucket(
      { content: 'bad data' },
      'Schema validation failed',
      tmpDir,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await readFile(result.value, 'utf8');
    const record = JSON.parse(content.trim());
    expect(record.error).toBe('Schema validation failed');
    expect(record.candidateInput).toEqual({ content: 'bad data' });
    expect(record.failedAt).toBeTruthy();
  });

  it('creates directory if needed', async () => {
    const nested = join(tmpDir, 'deep', 'failed');
    const result = await writeToFailureBucket({ x: 1 }, 'test error', nested);
    expect(result.ok).toBe(true);
  });
});
