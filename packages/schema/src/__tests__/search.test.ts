import { describe, it, expect } from 'vitest';
import { Pagination, SearchQuery, SearchHit, SearchResult } from '../search.js';
import { makeSearchQuery, makeSearchHit, makeSearchResult } from './fixtures.js';

describe('Pagination', () => {
  it('defaults page to 1 and pageSize to 20', () => {
    const result = Pagination.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('accepts custom values', () => {
    const result = Pagination.parse({ page: 3, pageSize: 50 });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(50);
  });

  it('rejects page < 1', () => {
    expect(() => Pagination.parse({ page: 0 })).toThrow();
  });

  it('rejects pageSize > 100', () => {
    expect(() => Pagination.parse({ pageSize: 101 })).toThrow();
  });

  it('rejects pageSize < 1', () => {
    expect(() => Pagination.parse({ pageSize: 0 })).toThrow();
  });
});

describe('SearchQuery', () => {
  it('parses minimal query with defaults', () => {
    const result = SearchQuery.parse(makeSearchQuery());
    expect(result.query).toBe('error handling');
    expect(result.scope).toBe('curated');
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.pageSize).toBe(20);
  });

  it('defaults scope to curated', () => {
    const result = SearchQuery.parse({ query: 'test' });
    expect(result.scope).toBe('curated');
  });

  it('accepts explicit scope', () => {
    const result = SearchQuery.parse(makeSearchQuery({ scope: 'all' }));
    expect(result.scope).toBe('all');
  });

  it('accepts inbox scope', () => {
    const result = SearchQuery.parse(makeSearchQuery({ scope: 'inbox' }));
    expect(result.scope).toBe('inbox');
  });

  it('accepts archived scope', () => {
    const result = SearchQuery.parse(makeSearchQuery({ scope: 'archived' }));
    expect(result.scope).toBe('archived');
  });

  it('accepts optional filters', () => {
    const result = SearchQuery.parse(
      makeSearchQuery({
        tenantId: 'team-alpha',
        categories: ['decision', 'pattern'],
        dateFrom: '2025-01-01T00:00:00Z',
        dateTo: '2026-01-01T00:00:00Z',
      }),
    );
    expect(result.tenantId).toBe('team-alpha');
    expect(result.categories).toEqual(['decision', 'pattern']);
  });

  it('rejects empty query', () => {
    expect(() => SearchQuery.parse({ query: '' })).toThrow();
  });

  it('rejects whitespace-only query', () => {
    expect(() => SearchQuery.parse({ query: '   ' })).toThrow();
  });

  it('rejects invalid scope', () => {
    expect(() => SearchQuery.parse(makeSearchQuery({ scope: 'private' as 'all' }))).toThrow();
  });

  it('rejects invalid category in categories array', () => {
    expect(() =>
      SearchQuery.parse(makeSearchQuery({ categories: ['invalid' as 'pattern'] })),
    ).toThrow();
  });
});

describe('SearchHit', () => {
  it('parses valid hit', () => {
    const result = SearchHit.parse(makeSearchHit());
    expect(result.score).toBe(0.85);
    expect(result.category).toBe('convention');
  });

  it('accepts score of 0', () => {
    const result = SearchHit.parse(makeSearchHit({ score: 0 }));
    expect(result.score).toBe(0);
  });

  it('accepts score of 1', () => {
    const result = SearchHit.parse(makeSearchHit({ score: 1 }));
    expect(result.score).toBe(1);
  });

  it('rejects score > 1', () => {
    expect(() => SearchHit.parse(makeSearchHit({ score: 1.1 }))).toThrow();
  });

  it('rejects score < 0', () => {
    expect(() => SearchHit.parse(makeSearchHit({ score: -0.1 }))).toThrow();
  });

  it('accepts optional highlightedContent', () => {
    const result = SearchHit.parse(
      makeSearchHit({ highlightedContent: 'Use <em>Result</em> type' }),
    );
    expect(result.highlightedContent).toBe('Use <em>Result</em> type');
  });
});

describe('SearchResult', () => {
  it('parses valid result', () => {
    const result = SearchResult.parse(makeSearchResult());
    expect(result.hits).toHaveLength(1);
    expect(result.totalCount).toBe(1);
    expect(result.hasMore).toBe(false);
  });

  it('accepts empty hits', () => {
    const result = SearchResult.parse(makeSearchResult({ hits: [], totalCount: 0 }));
    expect(result.hits).toHaveLength(0);
  });

  it('rejects negative totalCount', () => {
    expect(() => SearchResult.parse(makeSearchResult({ totalCount: -1 }))).toThrow();
  });

  it('rejects missing query', () => {
    const input = makeSearchResult();
    delete (input as Record<string, unknown>)['query'];
    expect(() => SearchResult.parse(input)).toThrow();
  });
});
