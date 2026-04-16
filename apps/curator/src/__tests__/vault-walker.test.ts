import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { walkVault, countVaultFiles } from '../import/vault-walker.js';

describe('walkVault', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'vault-test-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function writeFile(relativePath: string, content: string): void {
    const fullPath = join(root, relativePath);
    const dir = fullPath.split('/').slice(0, -1).join('/');
    mkdirSync(dir, { recursive: true });
    writeFileSync(fullPath, content, 'utf8');
  }

  it('collects Markdown files from flat directory', async () => {
    writeFile('note1.md', '# Note 1\nContent');
    writeFile('note2.md', '# Note 2\nContent');

    const files = await walkVault(root);
    expect(files).toHaveLength(2);
    expect(files.map((f) => f.relativePath).sort()).toEqual(['note1.md', 'note2.md']);
  });

  it('recurses into subdirectories', async () => {
    writeFile('top.md', 'Top level');
    writeFile('sub/nested.md', 'Nested');
    writeFile('sub/deep/leaf.md', 'Deep');

    const files = await walkVault(root);
    expect(files).toHaveLength(3);
    expect(files.map((f) => f.relativePath)).toContain('sub/nested.md');
    expect(files.map((f) => f.relativePath)).toContain('sub/deep/leaf.md');
  });

  it('excludes .obsidian directory', async () => {
    writeFile('note.md', 'Content');
    writeFile('.obsidian/config.json', '{}');
    writeFile('.obsidian/workspace.md', 'Workspace');

    const files = await walkVault(root);
    expect(files).toHaveLength(1);
    expect(files[0]!.relativePath).toBe('note.md');
  });

  it('excludes .trash directory', async () => {
    writeFile('note.md', 'Content');
    writeFile('.trash/deleted.md', 'Deleted');

    const files = await walkVault(root);
    expect(files).toHaveLength(1);
  });

  it('excludes .git directory', async () => {
    writeFile('note.md', 'Content');
    writeFile('.git/HEAD', 'ref: refs/heads/main');

    const files = await walkVault(root);
    expect(files).toHaveLength(1);
  });

  it('excludes node_modules', async () => {
    writeFile('note.md', 'Content');
    writeFile('node_modules/pkg/README.md', 'Package readme');

    const files = await walkVault(root);
    expect(files).toHaveLength(1);
  });

  it('supports custom exclude directories', async () => {
    writeFile('note.md', 'Content');
    writeFile('drafts/wip.md', 'Work in progress');

    const files = await walkVault(root, ['drafts']);
    expect(files).toHaveLength(1);
  });

  it('only includes Markdown extensions', async () => {
    writeFile('note.md', 'Markdown');
    writeFile('doc.markdown', 'Also markdown');
    writeFile('page.mdx', 'MDX');
    writeFile('image.png', 'binary');
    writeFile('data.json', '{}');
    writeFile('script.ts', 'code');

    const files = await walkVault(root);
    expect(files).toHaveLength(3);
  });

  it('skips empty files', async () => {
    writeFile('note.md', 'Content');
    writeFile('empty.md', '');
    writeFile('whitespace.md', '   \n  ');

    const files = await walkVault(root);
    expect(files).toHaveLength(1);
  });

  it('loads file content as UTF-8', async () => {
    writeFile('note.md', '# Hello World\n\nUnicode: ñ é ü');

    const files = await walkVault(root);
    expect(files[0]!.content).toContain('Unicode: ñ é ü');
  });

  it('returns empty array for empty directory', async () => {
    const files = await walkVault(root);
    expect(files).toEqual([]);
  });

  it('returns empty array for non-existent directory', async () => {
    const files = await walkVault('/definitely/not/a/real/path');
    expect(files).toEqual([]);
  });
});

describe('countVaultFiles', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'vault-count-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function writeFile(relativePath: string, content: string): void {
    const fullPath = join(root, relativePath);
    const dir = fullPath.split('/').slice(0, -1).join('/');
    mkdirSync(dir, { recursive: true });
    writeFileSync(fullPath, content, 'utf8');
  }

  it('counts Markdown files excluding defaults', async () => {
    writeFile('a.md', 'A');
    writeFile('b.md', 'B');
    writeFile('.obsidian/c.md', 'C');
    writeFile('sub/d.md', 'D');

    const count = await countVaultFiles(root);
    expect(count).toBe(3);
  });
});
