import { describe, it, expect } from 'vitest';
import { extractFrontmatter, renderFrontmatter } from '../formatter/frontmatter.js';
import { makeCuratedMemory, NOW, TENANT } from './fixtures.js';
import { randomUUID } from 'node:crypto';

describe('extractFrontmatter', () => {
  it('extracts id from memory', () => {
    const memory = makeCuratedMemory();
    const fm = extractFrontmatter(memory);
    expect(fm.id).toBe(memory.id);
  });

  it('extracts title from memory', () => {
    const memory = makeCuratedMemory({ title: 'My Pattern' });
    const fm = extractFrontmatter(memory);
    expect(fm.title).toBe('My Pattern');
  });

  it('extracts category from memory', () => {
    const memory = makeCuratedMemory({ category: 'decision' });
    const fm = extractFrontmatter(memory);
    expect(fm.category).toBe('decision');
  });

  it('formats author as "type:id"', () => {
    const memory = makeCuratedMemory({ author: { type: 'human', id: 'alice' } });
    const fm = extractFrontmatter(memory);
    expect(fm.author).toBe('human:alice');
  });

  it('extracts tags from metadata', () => {
    const memory = makeCuratedMemory({ metadata: { filePaths: [], tags: ['di', 'architecture'] } });
    const fm = extractFrontmatter(memory);
    expect(fm.tags).toEqual(['di', 'architecture']);
  });

  it('extracts empty tags when metadata.tags is empty', () => {
    const memory = makeCuratedMemory({ metadata: { filePaths: [], tags: [] } });
    const fm = extractFrontmatter(memory);
    expect(fm.tags).toEqual([]);
  });

  it('includes supersededBy when supersession is present', () => {
    const supersededById = randomUUID();
    const memory = makeCuratedMemory({
      lifecycle: 'superseded',
      supersession: {
        supersededBy: supersededById,
        reason: 'Updated version',
        linkedAt: NOW,
      },
    });
    const fm = extractFrontmatter(memory);
    expect(fm.supersededBy).toBe(supersededById);
  });

  it('omits supersededBy when supersession is absent', () => {
    const memory = makeCuratedMemory({ lifecycle: 'active' });
    const fm = extractFrontmatter(memory);
    expect(fm.supersededBy).toBeUndefined();
  });

  it('extracts all scalar fields correctly', () => {
    const memory = makeCuratedMemory();
    const fm = extractFrontmatter(memory);
    expect(fm.lifecycle).toBe('active');
    expect(fm.trustLevel).toBe('high');
    expect(fm.sensitivity).toBe('internal');
    expect(fm.tenantId).toBe(TENANT);
    expect(fm.contentHash).toBe(memory.contentHash);
    expect(fm.promotedAt).toBe(NOW);
    expect(fm.updatedAt).toBe(NOW);
    expect(fm.version).toBe(1);
  });
});

describe('renderFrontmatter', () => {
  it('starts and ends with ---', () => {
    const memory = makeCuratedMemory();
    const rendered = renderFrontmatter(extractFrontmatter(memory));
    const lines = rendered.split('\n');
    expect(lines[0]).toBe('---');
    expect(lines[lines.length - 1]).toBe('---');
  });

  it('renders all keys in deterministic order', () => {
    const memory = makeCuratedMemory();
    const rendered = renderFrontmatter(extractFrontmatter(memory));
    const lines = rendered.split('\n');
    const keys = lines
      .filter((l) => l.includes(':') && !l.startsWith('---') && !l.startsWith('  '))
      .map((l) => l.split(':')[0]);
    expect(keys).toEqual([
      'id',
      'title',
      'category',
      'lifecycle',
      'trust_level',
      'sensitivity',
      'tenant_id',
      'content_hash',
      'author',
      'promoted_at',
      'updated_at',
      'version',
      'tags',
    ]);
  });

  it('quotes all string values', () => {
    const memory = makeCuratedMemory({ title: 'Simple title' });
    const rendered = renderFrontmatter(extractFrontmatter(memory));
    expect(rendered).toContain('title: "Simple title"');
    expect(rendered).toContain('category: "pattern"');
    expect(rendered).toContain('lifecycle: "active"');
  });

  it('renders tags array with quoted items', () => {
    const memory = makeCuratedMemory({ metadata: { filePaths: [], tags: ['di', 'architecture'] } });
    const rendered = renderFrontmatter(extractFrontmatter(memory));
    expect(rendered).toContain('tags:');
    expect(rendered).toContain('  - "di"');
    expect(rendered).toContain('  - "architecture"');
  });

  it('renders empty tags as tags: []', () => {
    const memory = makeCuratedMemory({ metadata: { filePaths: [], tags: [] } });
    const rendered = renderFrontmatter(extractFrontmatter(memory));
    expect(rendered).toContain('tags: []');
  });

  it('includes superseded_by when supersession is present', () => {
    const supersededById = randomUUID();
    const memory = makeCuratedMemory({
      lifecycle: 'superseded',
      supersession: {
        supersededBy: supersededById,
        reason: 'Updated',
        linkedAt: NOW,
      },
    });
    const rendered = renderFrontmatter(extractFrontmatter(memory));
    expect(rendered).toContain(`superseded_by: "${supersededById}"`);
  });

  it('omits superseded_by when supersession is absent', () => {
    const memory = makeCuratedMemory({ lifecycle: 'active' });
    const rendered = renderFrontmatter(extractFrontmatter(memory));
    expect(rendered).not.toContain('superseded_by');
  });

  it('escapes double quotes in title', () => {
    const memory = makeCuratedMemory({ title: 'Pattern: use "strict" mode' });
    const rendered = renderFrontmatter(extractFrontmatter(memory));
    expect(rendered).toContain('title: "Pattern: use \\"strict\\" mode"');
  });

  it('escapes backslashes in title', () => {
    const memory = makeCuratedMemory({ title: 'Path is C:\\\\Users' });
    const rendered = renderFrontmatter(extractFrontmatter(memory));
    expect(rendered).toContain('title: "Path is C:\\\\\\\\Users"');
  });

  it('renders version as an unquoted integer', () => {
    const memory = makeCuratedMemory({ version: 3 });
    const rendered = renderFrontmatter(extractFrontmatter(memory));
    expect(rendered).toContain('version: 3');
    expect(rendered).not.toContain('version: "3"');
  });
});
