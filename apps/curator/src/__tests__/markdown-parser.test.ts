import { describe, it, expect } from 'vitest';
import { parseMarkdown, titleFromPath } from '../import/markdown-parser.js';

describe('parseMarkdown', () => {
  it('extracts frontmatter and body', () => {
    const md = `---
title: My Note
category: decision
---

This is the body.`;

    const result = parseMarkdown(md);
    expect(result.frontmatter['title']).toBe('My Note');
    expect(result.frontmatter['category']).toBe('decision');
    expect(result.body).toBe('This is the body.');
  });

  it('returns empty frontmatter when none present', () => {
    const md = '# Just a heading\n\nSome content.';
    const result = parseMarkdown(md);
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe('# Just a heading\n\nSome content.');
  });

  it('handles empty body after frontmatter', () => {
    const md = `---
title: Empty Body
---
`;
    const result = parseMarkdown(md);
    expect(result.frontmatter['title']).toBe('Empty Body');
    expect(result.body).toBe('');
  });

  it('parses boolean values', () => {
    const md = `---
published: true
draft: false
---

Content.`;

    const result = parseMarkdown(md);
    expect(result.frontmatter['published']).toBe(true);
    expect(result.frontmatter['draft']).toBe(false);
  });

  it('parses numeric values', () => {
    const md = `---
priority: 3
score: 0.85
---

Content.`;

    const result = parseMarkdown(md);
    expect(result.frontmatter['priority']).toBe(3);
    expect(result.frontmatter['score']).toBe(0.85);
  });

  it('parses flow arrays', () => {
    const md = `---
tags: [api, patterns, typescript]
---

Content.`;

    const result = parseMarkdown(md);
    expect(result.frontmatter['tags']).toEqual(['api', 'patterns', 'typescript']);
  });

  it('handles quoted strings', () => {
    const md = `---
title: "My Title: With Colons"
description: 'Single quoted'
---

Content.`;

    const result = parseMarkdown(md);
    expect(result.frontmatter['title']).toBe('My Title: With Colons');
    expect(result.frontmatter['description']).toBe('Single quoted');
  });

  it('skips comment lines in frontmatter', () => {
    const md = `---
# This is a comment
title: Real Title
---

Content.`;

    const result = parseMarkdown(md);
    expect(result.frontmatter['title']).toBe('Real Title');
    expect(Object.keys(result.frontmatter)).toHaveLength(1);
  });

  it('handles null/tilde values as empty string', () => {
    const md = `---
empty: null
also_empty: ~
bare_empty:
---

Content.`;

    const result = parseMarkdown(md);
    expect(result.frontmatter['empty']).toBe('');
    expect(result.frontmatter['also_empty']).toBe('');
    expect(result.frontmatter['bare_empty']).toBe('');
  });

  it('handles Obsidian-style frontmatter', () => {
    const md = `---
aliases: [API Design, API Patterns]
tags: [architecture, api]
created: 2026-01-15
---

# API Design Patterns

Content about API design.`;

    const result = parseMarkdown(md);
    expect(result.frontmatter['aliases']).toEqual(['API Design', 'API Patterns']);
    expect(result.frontmatter['tags']).toEqual(['architecture', 'api']);
    expect(result.frontmatter['created']).toBe('2026-01-15');
    expect(result.body).toContain('# API Design Patterns');
  });
});

describe('titleFromPath', () => {
  it('converts file path to title', () => {
    expect(titleFromPath('docs/error-handling-guide.md')).toBe('Error Handling Guide');
  });

  it('handles underscores', () => {
    expect(titleFromPath('api_design_patterns.md')).toBe('Api Design Patterns');
  });

  it('handles nested paths', () => {
    expect(titleFromPath('docs/architecture/system-overview.md')).toBe('System Overview');
  });

  it('handles bare filename', () => {
    expect(titleFromPath('README.md')).toBe('README');
  });
});
