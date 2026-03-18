import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  Uuid,
  Sha256Hash,
  IsoDatetime,
  NonEmptyString,
  SemVer,
  Tag,
  Author,
  ContentMetadata,
} from '../common.js';

describe('Uuid', () => {
  it('accepts a valid UUID v4', () => {
    const id = randomUUID();
    expect(Uuid.parse(id)).toBe(id);
  });
  it('rejects non-UUID strings', () => {
    expect(() => Uuid.parse('not-a-uuid')).toThrow();
  });
  it('rejects empty string', () => {
    expect(() => Uuid.parse('')).toThrow();
  });
});

describe('Sha256Hash', () => {
  it('accepts a valid 64-char hex hash', () => {
    const hash = 'a'.repeat(64);
    expect(Sha256Hash.parse(hash)).toBe(hash);
  });
  it('accepts mixed hex characters', () => {
    const hash = 'abcdef0123456789'.repeat(4);
    expect(Sha256Hash.parse(hash)).toBe(hash);
  });
  it('rejects uppercase hex', () => {
    expect(() => Sha256Hash.parse('A'.repeat(64))).toThrow();
  });
  it('rejects wrong length', () => {
    expect(() => Sha256Hash.parse('a'.repeat(63))).toThrow();
    expect(() => Sha256Hash.parse('a'.repeat(65))).toThrow();
  });
  it('rejects non-hex characters', () => {
    expect(() => Sha256Hash.parse('g'.repeat(64))).toThrow();
  });
});

describe('IsoDatetime', () => {
  it('accepts valid ISO datetime', () => {
    const dt = '2026-01-15T10:00:00.000Z';
    expect(IsoDatetime.parse(dt)).toBe(dt);
  });
  it('accepts datetime without milliseconds', () => {
    const dt = '2026-01-15T10:00:00Z';
    expect(IsoDatetime.parse(dt)).toBe(dt);
  });
  it('rejects date-only strings', () => {
    expect(() => IsoDatetime.parse('2026-01-15')).toThrow();
  });
  it('rejects invalid dates', () => {
    expect(() => IsoDatetime.parse('not-a-date')).toThrow();
  });
});

describe('NonEmptyString', () => {
  it('accepts non-empty string', () => {
    expect(NonEmptyString.parse('hello')).toBe('hello');
  });
  it('trims whitespace', () => {
    expect(NonEmptyString.parse('  hello  ')).toBe('hello');
  });
  it('rejects empty string', () => {
    expect(() => NonEmptyString.parse('')).toThrow();
  });
  it('rejects whitespace-only string', () => {
    expect(() => NonEmptyString.parse('   ')).toThrow();
  });
});

describe('SemVer', () => {
  it('accepts valid semver', () => {
    expect(SemVer.parse('1.2.3')).toBe('1.2.3');
  });
  it('accepts zero versions', () => {
    expect(SemVer.parse('0.0.0')).toBe('0.0.0');
  });
  it('rejects two-part versions', () => {
    expect(() => SemVer.parse('1.2')).toThrow();
  });
  it('rejects prerelease suffixes', () => {
    expect(() => SemVer.parse('1.2.3-alpha')).toThrow();
  });
});

describe('Tag', () => {
  it('accepts lowercase tags', () => {
    expect(Tag.parse('api-design')).toBe('api-design');
  });
  it('accepts numeric tags', () => {
    expect(Tag.parse('v2')).toBe('v2');
  });
  it('rejects uppercase', () => {
    expect(() => Tag.parse('API')).toThrow();
  });
  it('rejects starting with hyphen', () => {
    expect(() => Tag.parse('-api')).toThrow();
  });
});

describe('Author', () => {
  it('accepts valid author', () => {
    const result = Author.parse({ type: 'human', id: 'user-1', name: 'Test' });
    expect(result.type).toBe('human');
    expect(result.id).toBe('user-1');
    expect(result.name).toBe('Test');
  });
  it('allows optional name', () => {
    const result = Author.parse({ type: 'ai', id: 'claude' });
    expect(result.name).toBeUndefined();
  });
  it('rejects missing id', () => {
    expect(() => Author.parse({ type: 'human' })).toThrow();
  });
  it('rejects invalid author type', () => {
    expect(() => Author.parse({ type: 'bot', id: 'x' })).toThrow();
  });
});

describe('ContentMetadata', () => {
  it('accepts full metadata', () => {
    const meta = ContentMetadata.parse({
      filePaths: ['src/index.ts'],
      language: 'typescript',
      projectContext: 'qmd-team-intent-kb',
      sessionId: 'sess-123',
      repoUrl: 'https://github.com/org/repo',
      branch: 'main',
      confidence: 'high',
      sensitivity: 'internal',
      tags: ['api-design', 'patterns'],
    });
    expect(meta.filePaths).toEqual(['src/index.ts']);
    expect(meta.tags).toEqual(['api-design', 'patterns']);
  });
  it('defaults filePaths to empty array', () => {
    const meta = ContentMetadata.parse({});
    expect(meta.filePaths).toEqual([]);
  });
  it('defaults tags to empty array', () => {
    const meta = ContentMetadata.parse({});
    expect(meta.tags).toEqual([]);
  });
  it('rejects invalid confidence', () => {
    expect(() => ContentMetadata.parse({ confidence: 'very_high' })).toThrow();
  });
});
