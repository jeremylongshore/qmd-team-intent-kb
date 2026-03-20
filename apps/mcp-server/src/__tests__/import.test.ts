import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { McpServerConfig } from '../config.js';
import { importFiles } from '../tools/import.js';

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

describe('importFiles()', () => {
  let spoolDir: string;
  let srcDir: string;
  let config: McpServerConfig;

  beforeEach(() => {
    spoolDir = mkdtempSync(join(tmpdir(), 'teamkb-import-spool-'));
    srcDir = mkdtempSync(join(tmpdir(), 'teamkb-import-src-'));
    config = makeConfig(spoolDir);
  });

  afterEach(() => {
    rmSync(spoolDir, { recursive: true, force: true });
    rmSync(srcDir, { recursive: true, force: true });
  });

  it('returns queued=0 and failed=0 when no files match', async () => {
    const result = await importFiles({ glob: '**/*.md', basePath: srcDir }, config, nowFn);
    expect(result.queued).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.outcomes).toHaveLength(0);
  });

  it('queues one candidate per matching file', async () => {
    writeFileSync(join(srcDir, 'a.md'), 'Content of A');
    writeFileSync(join(srcDir, 'b.md'), 'Content of B');

    const result = await importFiles({ glob: '*.md', basePath: srcDir }, config, nowFn);

    expect(result.queued).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.outcomes).toHaveLength(2);
    expect(result.outcomes.every((o) => o.ok)).toBe(true);
  });

  it('writes candidates to the spool', async () => {
    writeFileSync(join(srcDir, 'note.md'), 'Important note content');

    await importFiles({ glob: '*.md', basePath: srcDir }, config, nowFn);

    const files = readdirSync(spoolDir).filter((f) => f.endsWith('.jsonl'));
    expect(files.length).toBeGreaterThan(0);
  });

  it('uses heuristic category from directory name', async () => {
    const decisionDir = join(srcDir, 'decisions');
    mkdirSync(decisionDir);
    writeFileSync(join(decisionDir, 'adr-001.md'), 'We decided to use SQLite.');

    await importFiles({ glob: 'decisions/*.md', basePath: srcDir }, config, nowFn);

    const files = readdirSync(spoolDir).filter((f) => f.endsWith('.jsonl'));
    const line = readFileSync(join(spoolDir, files[0]!), 'utf8').trim();
    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(parsed['category']).toBe('decision');
  });

  it('derives title from filename without extension', async () => {
    writeFileSync(join(srcDir, 'use-result-type.md'), 'Always use Result<T,E>.');

    await importFiles({ glob: '*.md', basePath: srcDir }, config, nowFn);

    const files = readdirSync(spoolDir).filter((f) => f.endsWith('.jsonl'));
    const parsed = JSON.parse(readFileSync(join(spoolDir, files[0]!), 'utf8').trim()) as Record<
      string,
      unknown
    >;
    expect(parsed['title']).toBe('Use Result Type');
  });

  it('reports failed outcome for empty file', async () => {
    writeFileSync(join(srcDir, 'empty.md'), '');

    const result = await importFiles({ glob: '*.md', basePath: srcDir }, config, nowFn);

    expect(result.failed).toBe(1);
    expect(result.queued).toBe(0);
    const outcome = result.outcomes[0];
    expect(outcome?.ok).toBe(false);
    expect(outcome?.error).toMatch(/empty/i);
  });

  it('continues importing remaining files after one failure', async () => {
    writeFileSync(join(srcDir, 'empty.md'), '');
    writeFileSync(join(srcDir, 'good.md'), 'Valid content here');

    const result = await importFiles({ glob: '*.md', basePath: srcDir }, config, nowFn);

    expect(result.queued).toBe(1);
    expect(result.failed).toBe(1);
  });

  it('sets source to "import" on each candidate', async () => {
    writeFileSync(join(srcDir, 'x.md'), 'Some content');

    await importFiles({ glob: '*.md', basePath: srcDir }, config, nowFn);

    const files = readdirSync(spoolDir).filter((f) => f.endsWith('.jsonl'));
    const parsed = JSON.parse(readFileSync(join(spoolDir, files[0]!), 'utf8').trim()) as Record<
      string,
      unknown
    >;
    expect(parsed['source']).toBe('import');
  });

  it('stores the absolute file path in metadata.filePaths', async () => {
    writeFileSync(join(srcDir, 'guide.md'), 'Guide content');

    await importFiles({ glob: '*.md', basePath: srcDir }, config, nowFn);

    const files = readdirSync(spoolDir).filter((f) => f.endsWith('.jsonl'));
    const parsed = JSON.parse(readFileSync(join(spoolDir, files[0]!), 'utf8').trim()) as {
      metadata: { filePaths: string[] };
    };
    expect(parsed.metadata.filePaths).toHaveLength(1);
    expect(parsed.metadata.filePaths[0]).toContain('guide.md');
  });

  it('defaults basePath to process.cwd() when omitted', async () => {
    // With no matching files from cwd this should just return 0 queued
    const result = await importFiles(
      { glob: 'nonexistent-glob-pattern-xyz-abc/*.md' },
      config,
      nowFn,
    );
    expect(result.queued).toBe(0);
  });
});
