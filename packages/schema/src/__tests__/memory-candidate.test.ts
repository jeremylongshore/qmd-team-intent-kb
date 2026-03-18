import { describe, it, expect } from 'vitest';
import { MemoryCandidate, PrePolicyFlags } from '../memory-candidate.js';
import { makeMemoryCandidate } from './fixtures.js';

describe('PrePolicyFlags', () => {
  it('defaults all flags to false', () => {
    const flags = PrePolicyFlags.parse({});
    expect(flags.potentialSecret).toBe(false);
    expect(flags.lowConfidence).toBe(false);
    expect(flags.duplicateSuspect).toBe(false);
  });

  it('accepts explicit flag values', () => {
    const flags = PrePolicyFlags.parse({ potentialSecret: true, lowConfidence: true });
    expect(flags.potentialSecret).toBe(true);
    expect(flags.lowConfidence).toBe(true);
    expect(flags.duplicateSuspect).toBe(false);
  });
});

describe('MemoryCandidate', () => {
  it('parses a valid candidate', () => {
    const input = makeMemoryCandidate();
    const result = MemoryCandidate.parse(input);
    expect(result.status).toBe('inbox');
    expect(result.source).toBe('claude_session');
    expect(result.category).toBe('convention');
  });

  it('defaults trustLevel to medium', () => {
    const input = makeMemoryCandidate();
    delete (input as Record<string, unknown>)['trustLevel'];
    const result = MemoryCandidate.parse(input);
    expect(result.trustLevel).toBe('medium');
  });

  it('defaults metadata to empty', () => {
    const input = makeMemoryCandidate();
    delete (input as Record<string, unknown>)['metadata'];
    const result = MemoryCandidate.parse(input);
    expect(result.metadata.filePaths).toEqual([]);
    expect(result.metadata.tags).toEqual([]);
  });

  it('defaults prePolicyFlags to all false', () => {
    const input = makeMemoryCandidate();
    delete (input as Record<string, unknown>)['prePolicyFlags'];
    const result = MemoryCandidate.parse(input);
    expect(result.prePolicyFlags.potentialSecret).toBe(false);
  });

  it('rejects missing required id', () => {
    const input = makeMemoryCandidate();
    delete (input as Record<string, unknown>)['id'];
    expect(() => MemoryCandidate.parse(input)).toThrow();
  });

  it('rejects missing required content', () => {
    const input = makeMemoryCandidate();
    delete (input as Record<string, unknown>)['content'];
    expect(() => MemoryCandidate.parse(input)).toThrow();
  });

  it('rejects empty content', () => {
    expect(() => MemoryCandidate.parse(makeMemoryCandidate({ content: '' }))).toThrow();
  });

  it('rejects empty title', () => {
    expect(() => MemoryCandidate.parse(makeMemoryCandidate({ title: '' }))).toThrow();
  });

  it('rejects invalid source', () => {
    expect(() =>
      MemoryCandidate.parse(makeMemoryCandidate({ source: 'email' as 'manual' })),
    ).toThrow();
  });

  it('rejects invalid category', () => {
    expect(() =>
      MemoryCandidate.parse(makeMemoryCandidate({ category: 'other' as 'pattern' })),
    ).toThrow();
  });

  it('rejects non-inbox status', () => {
    expect(() =>
      MemoryCandidate.parse(makeMemoryCandidate({ status: 'review' as 'inbox' })),
    ).toThrow();
  });

  it('rejects invalid UUID for id', () => {
    expect(() => MemoryCandidate.parse(makeMemoryCandidate({ id: 'not-a-uuid' }))).toThrow();
  });

  it('accepts all valid sources', () => {
    for (const source of ['claude_session', 'manual', 'import', 'mcp'] as const) {
      expect(MemoryCandidate.parse(makeMemoryCandidate({ source })).source).toBe(source);
    }
  });

  it('accepts all valid categories', () => {
    const categories = [
      'decision',
      'pattern',
      'convention',
      'architecture',
      'troubleshooting',
      'onboarding',
      'reference',
    ] as const;
    for (const category of categories) {
      expect(MemoryCandidate.parse(makeMemoryCandidate({ category })).category).toBe(category);
    }
  });

  it('preserves metadata fields', () => {
    const result = MemoryCandidate.parse(
      makeMemoryCandidate({
        metadata: {
          filePaths: ['src/main.ts'],
          language: 'typescript',
          tags: ['api'],
        },
      }),
    );
    expect(result.metadata.filePaths).toEqual(['src/main.ts']);
    expect(result.metadata.language).toBe('typescript');
  });
});
