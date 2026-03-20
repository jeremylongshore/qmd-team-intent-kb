import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { McpServerConfig } from '../config.js';
import { propose } from '../tools/propose.js';

const FIXED_NOW = '2026-01-15T10:00:00.000Z';
const nowFn = () => FIXED_NOW;

function makeConfig(spoolPath: string): McpServerConfig {
  return {
    tenantId: 'test-tenant',
    basePath: spoolPath,
    spoolPath,
    dbPath: join(spoolPath, 'teamkb.db'),
    feedbackPath: join(spoolPath, 'feedback'),
  };
}

describe('propose()', () => {
  let tmpDir: string;
  let config: McpServerConfig;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'teamkb-propose-'));
    config = makeConfig(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns a valid UUID candidate ID', async () => {
    const result = await propose(
      { title: 'Use Result<T,E> for errors', content: 'Never throw, always return.' },
      config,
      nowFn,
    );
    expect(result.candidateId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('returns a success message containing the candidate ID', async () => {
    const result = await propose(
      { title: 'Prefer named exports', content: 'Always use named exports.' },
      config,
      nowFn,
    );
    expect(result.message).toContain(result.candidateId);
  });

  it('writes a JSONL file to the spool directory', async () => {
    await propose({ title: 'Test entry', content: 'Content goes here.' }, config, nowFn);
    const files = readdirSync(tmpDir);
    expect(files.length).toBeGreaterThan(0);
  });

  it('writes a valid JSON candidate to the spool file', async () => {
    const result = await propose({ title: 'My Title', content: 'My content.' }, config, nowFn);

    const files = readdirSync(tmpDir).filter((f) => f.endsWith('.jsonl'));
    expect(files.length).toBeGreaterThan(0);

    const line = readFileSync(join(tmpDir, files[0]!), 'utf8').trim();
    const parsed = JSON.parse(line) as Record<string, unknown>;

    expect(parsed['id']).toBe(result.candidateId);
    expect(parsed['status']).toBe('inbox');
    expect(parsed['source']).toBe('mcp');
    expect(parsed['title']).toBe('My Title');
    expect(parsed['content']).toBe('My content.');
    expect(parsed['tenantId']).toBe('test-tenant');
    expect(parsed['capturedAt']).toBe(FIXED_NOW);
  });

  it('defaults category to "reference" when not supplied', async () => {
    await propose({ title: 'T', content: 'C' }, config, nowFn);
    const files = readdirSync(tmpDir).filter((f) => f.endsWith('.jsonl'));
    const parsed = JSON.parse(readFileSync(join(tmpDir, files[0]!), 'utf8').trim()) as Record<
      string,
      unknown
    >;
    expect(parsed['category']).toBe('reference');
  });

  it('uses the supplied category', async () => {
    await propose({ title: 'T', content: 'C', category: 'decision' }, config, nowFn);
    const files = readdirSync(tmpDir).filter((f) => f.endsWith('.jsonl'));
    const parsed = JSON.parse(readFileSync(join(tmpDir, files[0]!), 'utf8').trim()) as Record<
      string,
      unknown
    >;
    expect(parsed['category']).toBe('decision');
  });

  it('writes filePaths to candidate metadata', async () => {
    await propose(
      { title: 'T', content: 'C', filePaths: ['src/api.ts', 'src/auth.ts'] },
      config,
      nowFn,
    );
    const files = readdirSync(tmpDir).filter((f) => f.endsWith('.jsonl'));
    const parsed = JSON.parse(readFileSync(join(tmpDir, files[0]!), 'utf8').trim()) as {
      metadata: { filePaths: string[] };
    };
    expect(parsed.metadata.filePaths).toEqual(['src/api.ts', 'src/auth.ts']);
  });

  it('each call generates a different candidate ID', async () => {
    const a = await propose({ title: 'T', content: 'C' }, config, nowFn);
    const b = await propose({ title: 'T', content: 'C' }, config, nowFn);
    expect(a.candidateId).not.toBe(b.candidateId);
  });

  it('appends multiple candidates to the same spool file', async () => {
    await propose({ title: 'First', content: 'First content.' }, config, nowFn);
    await propose({ title: 'Second', content: 'Second content.' }, config, nowFn);

    const files = readdirSync(tmpDir).filter((f) => f.endsWith('.jsonl'));
    const content = readFileSync(join(tmpDir, files[0]!), 'utf8').trim();
    const lines = content.split('\n').filter(Boolean);
    expect(lines.length).toBe(2);
  });
});
