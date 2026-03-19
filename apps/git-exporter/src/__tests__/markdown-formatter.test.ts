import { describe, it, expect } from 'vitest';
import { formatMemoryAsMarkdown, getFilename } from '../formatter/markdown-formatter.js';
import { makeCuratedMemory } from './fixtures.js';

describe('formatMemoryAsMarkdown', () => {
  it('produces a document that starts with ---', () => {
    const memory = makeCuratedMemory();
    const doc = formatMemoryAsMarkdown(memory);
    expect(doc.startsWith('---\n')).toBe(true);
  });

  it('includes the frontmatter block closed with ---', () => {
    const memory = makeCuratedMemory();
    const doc = formatMemoryAsMarkdown(memory);
    const lines = doc.split('\n');
    // First line is ---, second --- that closes frontmatter should exist
    const closingIdx = lines.indexOf('---', 1);
    expect(closingIdx).toBeGreaterThan(0);
  });

  it('heading matches the memory title', () => {
    const memory = makeCuratedMemory({ title: 'My Custom Pattern' });
    const doc = formatMemoryAsMarkdown(memory);
    expect(doc).toContain('# My Custom Pattern\n');
  });

  it('content is preserved verbatim', () => {
    const content = 'Use dependency injection for all services';
    const memory = makeCuratedMemory({ content });
    const doc = formatMemoryAsMarkdown(memory);
    expect(doc).toContain(content);
  });

  it('preserves multi-line content verbatim', () => {
    const content = 'Line one\nLine two\nLine three';
    const memory = makeCuratedMemory({ content });
    const doc = formatMemoryAsMarkdown(memory);
    expect(doc).toContain('Line one\nLine two\nLine three');
  });

  it('document structure is frontmatter + blank line + heading + blank line + content + trailing newline', () => {
    const memory = makeCuratedMemory({
      title: 'Test Title',
      content: 'Test content here.',
    });
    const doc = formatMemoryAsMarkdown(memory);
    // After the closing ---, expect \n\n# Title\n\nContent\n
    const afterFrontmatter = doc.substring(doc.lastIndexOf('---') + 3);
    expect(afterFrontmatter).toBe('\n\n# Test Title\n\nTest content here.\n');
  });
});

describe('getFilename', () => {
  it('returns {id}.md', () => {
    const memory = makeCuratedMemory();
    expect(getFilename(memory)).toBe(`${memory.id}.md`);
  });

  it('filename changes when id changes', () => {
    const m1 = makeCuratedMemory();
    const m2 = makeCuratedMemory();
    expect(getFilename(m1)).not.toBe(getFilename(m2));
  });
});
