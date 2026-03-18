import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeRedactionAudit } from '../spool/redaction-audit.js';
import type { SecretMatch } from '../types.js';

describe('writeRedactionAudit', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'audit-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('writes a redaction audit record', async () => {
    const matches: SecretMatch[] = [
      { patternId: 'aws-key', patternName: 'AWS Access Key', line: 3, column: 5, matchLength: 20 },
    ];

    const result = await writeRedactionAudit('candidate-123', matches, tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await readFile(result.value, 'utf8');
    const record = JSON.parse(content.trim());
    expect(record.candidateId).toBe('candidate-123');
    expect(record.matches).toHaveLength(1);
    expect(record.matches[0].patternId).toBe('aws-key');
    expect(record.redactedAt).toBeTruthy();
  });
});
