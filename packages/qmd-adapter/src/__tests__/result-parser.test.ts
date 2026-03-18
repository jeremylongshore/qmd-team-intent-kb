import { describe, it, expect } from 'vitest';
import { parseQueryOutput, deriveCollectionFromPath } from '../search/result-parser.js';

describe('parseQueryOutput', () => {
  it('parses tab-separated output', () => {
    const output = '0.95\t/data/kb-curated/doc.md\tSome relevant snippet';
    const results = parseQueryOutput(output);
    expect(results).toHaveLength(1);
    expect(results[0]!.score).toBe(0.95);
    expect(results[0]!.file).toBe('/data/kb-curated/doc.md');
    expect(results[0]!.snippet).toBe('Some relevant snippet');
    expect(results[0]!.collection).toBe('kb-curated');
  });

  it('parses multiple lines', () => {
    const output = '0.9\t/kb-curated/a.md\tA\n0.8\t/kb-guides/b.md\tB\n0.7\t/kb-inbox/c.md\tC';
    const results = parseQueryOutput(output);
    expect(results).toHaveLength(3);
  });

  it('handles empty output', () => {
    expect(parseQueryOutput('')).toHaveLength(0);
    expect(parseQueryOutput('\n')).toHaveLength(0);
  });

  it('handles non-numeric scores', () => {
    const output = 'NaN\t/kb-curated/doc.md\tSnippet';
    const results = parseQueryOutput(output);
    expect(results[0]!.score).toBe(0);
  });
});

describe('deriveCollectionFromPath', () => {
  it('derives kb-curated', () => {
    expect(deriveCollectionFromPath('/data/kb-curated/doc.md')).toBe('kb-curated');
  });

  it('derives kb-inbox', () => {
    expect(deriveCollectionFromPath('/data/kb-inbox/doc.md')).toBe('kb-inbox');
  });

  it('returns unknown for unrecognized paths', () => {
    expect(deriveCollectionFromPath('/data/random/doc.md')).toBe('unknown');
  });
});
