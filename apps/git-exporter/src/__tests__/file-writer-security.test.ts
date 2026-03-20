import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeFile, archiveFile, removeFile } from '../writer/file-writer.js';

// ---------------------------------------------------------------------------
// writeFile — path traversal guard
// ---------------------------------------------------------------------------

describe('writeFile — path traversal rejection', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'exporter-write-sec-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('rejects path containing ".." segments when exportRoot is provided', () => {
    const safePath = join(dir, 'curated', '..', '..', 'etc', 'passwd');
    expect(() => writeFile(safePath, 'evil', dir)).toThrow(/traversal|unsafe/i);
  });

  it('rejects path containing null byte when exportRoot is provided', () => {
    const evilPath = join(dir, `file\0.md`);
    expect(() => writeFile(evilPath, 'evil', dir)).toThrow(/null byte|unsafe/i);
  });

  it('rejects ".." in path even without an explicit exportRoot', () => {
    // Use string concatenation to keep ".." as a literal path segment — node:path
    // join() would resolve ".." away before the check can see it.
    const evilPath = dir + '/../escape.md';
    expect(() => writeFile(evilPath, 'content')).toThrow(/traversal|unsafe/i);
  });

  it('rejects null byte in path even without an explicit exportRoot', () => {
    // Use string concatenation — join() strips null bytes on some platforms
    const evilPath = dir + '/mem\0ory.md';
    expect(() => writeFile(evilPath, 'content')).toThrow(/null byte|unsafe/i);
  });

  it('accepts a valid path that stays within exportRoot', () => {
    const validPath = join(dir, 'curated', 'memory.md');
    expect(() => writeFile(validPath, 'safe content', dir)).not.toThrow();
    expect(existsSync(validPath)).toBe(true);
  });

  it('rejects path that resolves outside exportRoot even without explicit ".."', () => {
    // A symlink or absolute path outside the root — use absolute path outside dir
    const outsidePath = join(tmpdir(), 'outside-export.md');
    expect(() => writeFile(outsidePath, 'evil', dir)).toThrow(/traversal|outside/i);
  });
});

// ---------------------------------------------------------------------------
// archiveFile — path traversal guard for both from and to paths
// ---------------------------------------------------------------------------

describe('archiveFile — path traversal rejection', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'exporter-archive-sec-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('rejects toPath containing ".." when exportRoot is provided', () => {
    const fromPath = join(dir, 'curated', 'mem.md');
    const toPath = join(dir, '..', '..', 'etc', 'evil.md');
    expect(() => archiveFile(fromPath, toPath, 'content', dir)).toThrow(/traversal|unsafe/i);
  });

  it('rejects toPath containing null byte when exportRoot is provided', () => {
    const fromPath = join(dir, 'curated', 'mem.md');
    const toPath = join(dir, `archive\0.md`);
    expect(() => archiveFile(fromPath, toPath, 'content', dir)).toThrow(/null byte|unsafe/i);
  });

  it('rejects fromPath containing ".." when exportRoot is provided', () => {
    const fromPath = join(dir, '..', '..', 'etc', 'source.md');
    const toPath = join(dir, 'archive', 'mem.md');
    expect(() => archiveFile(fromPath, toPath, 'content', dir)).toThrow(/traversal|unsafe/i);
  });

  it('rejects fromPath containing null byte when exportRoot is provided', () => {
    const fromPath = join(dir, `source\0.md`);
    const toPath = join(dir, 'archive', 'dest.md');
    expect(() => archiveFile(fromPath, toPath, 'content', dir)).toThrow(/null byte|unsafe/i);
  });

  it('does not validate fromPath when no exportRoot is given', () => {
    // Without exportRoot, fromPath is not validated (only toPath always checked).
    // Provide a non-existent fromPath with a ".." — should not throw on path check.
    // Note: ".." in toPath is always blocked regardless of exportRoot.
    const fromPath = join(dir, 'nonexistent.md');
    const toPath = join(dir, 'valid-dest.md');
    expect(() => archiveFile(fromPath, toPath, 'content')).not.toThrow();
    expect(existsSync(toPath)).toBe(true);
  });

  it('accepts valid from and to paths within exportRoot', () => {
    const fromPath = join(dir, 'curated', 'mem.md');
    const toPath = join(dir, 'archive', 'mem.md');
    mkdirSync(join(dir, 'curated'), { recursive: true });
    writeFileSync(fromPath, 'old content', 'utf8');

    expect(() => archiveFile(fromPath, toPath, 'new content', dir)).not.toThrow();
    expect(existsSync(toPath)).toBe(true);
    expect(existsSync(fromPath)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// removeFile — path traversal guard when exportRoot is provided
// ---------------------------------------------------------------------------

describe('removeFile — path traversal rejection', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'exporter-remove-sec-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('rejects path with ".." when exportRoot is provided', () => {
    const evilPath = join(dir, '..', '..', 'etc', 'passwd');
    expect(() => removeFile(evilPath, dir)).toThrow(/traversal|unsafe/i);
  });

  it('rejects path with null byte when exportRoot is provided', () => {
    const evilPath = join(dir, `file\0.md`);
    expect(() => removeFile(evilPath, dir)).toThrow(/null byte|unsafe/i);
  });

  it('accepts valid path within exportRoot', () => {
    const filePath = join(dir, 'valid.md');
    writeFileSync(filePath, 'content', 'utf8');
    expect(() => removeFile(filePath, dir)).not.toThrow();
    expect(existsSync(filePath)).toBe(false);
  });

  it('does not validate path when no exportRoot is given', () => {
    // Without exportRoot, path validation is skipped — only existence matters
    const filePath = join(dir, 'removable.md');
    writeFileSync(filePath, 'content', 'utf8');
    const result = removeFile(filePath);
    expect(result).toBe(true);
  });
});
