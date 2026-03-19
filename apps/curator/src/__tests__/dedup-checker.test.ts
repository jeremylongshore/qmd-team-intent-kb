import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase, MemoryRepository } from '@qmd-team-intent-kb/store';
import { computeContentHash } from '@qmd-team-intent-kb/common';
import { checkDuplicate } from '../dedup/dedup-checker.js';
import { makeCandidate, makeCuratedMemory } from './fixtures.js';

describe('checkDuplicate', () => {
  let memoryRepo: MemoryRepository;

  beforeEach(() => {
    const db = createTestDatabase();
    memoryRepo = new MemoryRepository(db);
  });

  it('returns isDuplicate=false when no memories exist in store', () => {
    const candidate = makeCandidate();
    const result = checkDuplicate(candidate, memoryRepo);
    expect(result.isDuplicate).toBe(false);
    expect(result.matchedMemoryId).toBeUndefined();
  });

  it('returns isDuplicate=false for unique content not in store', () => {
    const existing = makeCuratedMemory({ content: 'Some existing curated memory content here.' });
    memoryRepo.insert(existing);

    const candidate = makeCandidate({
      content: 'Completely different content for this candidate.',
    });
    const result = checkDuplicate(candidate, memoryRepo);
    expect(result.isDuplicate).toBe(false);
    expect(result.matchedMemoryId).toBeUndefined();
  });

  it('detects exact hash duplicate and returns matched memory ID', () => {
    const content = 'Use Result<T, E> for all fallible operations in the codebase';
    const existing = makeCuratedMemory({ content });
    memoryRepo.insert(existing);

    const candidate = makeCandidate({ content });
    const result = checkDuplicate(candidate, memoryRepo);
    expect(result.isDuplicate).toBe(true);
    expect(result.matchedMemoryId).toBe(existing.id);
  });

  it('returns matchType as exact_hash when duplicate is detected', () => {
    const content = 'Always use strict null checks in TypeScript code';
    const existing = makeCuratedMemory({ content });
    memoryRepo.insert(existing);

    const candidate = makeCandidate({ content });
    const result = checkDuplicate(candidate, memoryRepo);
    expect(result.matchType).toBe('exact_hash');
  });

  it('always includes contentHash in result', () => {
    const candidate = makeCandidate({ content: 'Some unique content not in store at all' });
    const result = checkDuplicate(candidate, memoryRepo);
    const expected = computeContentHash(candidate.content);
    expect(result.contentHash).toBe(expected);
  });

  it('contentHash in result matches expected SHA-256 for duplicate', () => {
    const content = 'Repository pattern for database access in Node.js';
    const existing = makeCuratedMemory({ content });
    memoryRepo.insert(existing);

    const candidate = makeCandidate({ content });
    const result = checkDuplicate(candidate, memoryRepo);
    expect(result.contentHash).toBe(computeContentHash(content));
  });

  it('different content produces different hashes and no duplicate', () => {
    const content1 = 'First piece of content for testing dedup logic here';
    const content2 = 'Second piece of content that is completely different here';

    const existing = makeCuratedMemory({ content: content1 });
    memoryRepo.insert(existing);

    const candidate = makeCandidate({ content: content2 });
    const result = checkDuplicate(candidate, memoryRepo);
    expect(result.isDuplicate).toBe(false);
    expect(result.contentHash).toBe(computeContentHash(content2));
    expect(result.contentHash).not.toBe(computeContentHash(content1));
  });

  it('same content always produces same hash regardless of candidate ID', () => {
    const content = 'Use pnpm workspaces for monorepo dependency management';
    const candidate1 = makeCandidate({ content });
    const candidate2 = makeCandidate({ content });
    const result1 = checkDuplicate(candidate1, memoryRepo);
    const result2 = checkDuplicate(candidate2, memoryRepo);
    expect(result1.contentHash).toBe(result2.contentHash);
  });
});
