import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeFile, archiveFile, removeFile } from '../writer/file-writer.js';

describe('writeFile', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'git-exporter-write-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates file and parent directories', () => {
    const filePath = join(dir, 'subdir', 'nested', 'file.md');
    writeFile(filePath, 'hello world');
    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(filePath, 'utf8')).toBe('hello world');
  });

  it('overwrites existing file with new content', () => {
    const filePath = join(dir, 'file.md');
    writeFile(filePath, 'original');
    writeFile(filePath, 'updated');
    expect(readFileSync(filePath, 'utf8')).toBe('updated');
  });

  it('creates file with exact content (no trailing mutation)', () => {
    const content = '---\nid: "abc"\n---\n\n# Title\n\nContent\n';
    const filePath = join(dir, 'memory.md');
    writeFile(filePath, content);
    expect(readFileSync(filePath, 'utf8')).toBe(content);
  });
});

describe('archiveFile', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'git-exporter-archive-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('removes source file and writes to destination', () => {
    const fromPath = join(dir, 'curated', 'mem.md');
    const toPath = join(dir, 'archive', 'mem.md');
    mkdirSync(join(dir, 'curated'), { recursive: true });
    writeFileSync(fromPath, 'old content', 'utf8');

    archiveFile(fromPath, toPath, 'new content');

    expect(existsSync(fromPath)).toBe(false);
    expect(existsSync(toPath)).toBe(true);
    expect(readFileSync(toPath, 'utf8')).toBe('new content');
  });

  it('writes to destination even when source does not exist', () => {
    const fromPath = join(dir, 'curated', 'nonexistent.md');
    const toPath = join(dir, 'archive', 'mem.md');

    archiveFile(fromPath, toPath, 'archive content');

    expect(existsSync(toPath)).toBe(true);
    expect(readFileSync(toPath, 'utf8')).toBe('archive content');
  });

  it('creates destination parent directories', () => {
    const toPath = join(dir, 'deep', 'nested', 'archive', 'mem.md');
    archiveFile(join(dir, 'nonexistent.md'), toPath, 'content');
    expect(existsSync(toPath)).toBe(true);
  });
});

describe('removeFile', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'git-exporter-remove-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('deletes file and returns true', () => {
    const filePath = join(dir, 'file.md');
    writeFileSync(filePath, 'content', 'utf8');

    const result = removeFile(filePath);
    expect(result).toBe(true);
    expect(existsSync(filePath)).toBe(false);
  });

  it('returns false for non-existent file', () => {
    const filePath = join(dir, 'nonexistent.md');
    const result = removeFile(filePath);
    expect(result).toBe(false);
  });
});
