import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { computeContentHash } from '@qmd-team-intent-kb/common';
import {
  createTestDatabase,
  MemoryRepository,
  CandidateRepository,
} from '@qmd-team-intent-kb/store';
import { detectCollision } from '../import/collision-detector.js';
import { makeCandidate, makeCuratedMemory } from './fixtures.js';

describe('detectCollision', () => {
  let db: Database.Database;
  let memoryRepo: MemoryRepository;
  let candidateRepo: CandidateRepository;

  beforeEach(() => {
    db = createTestDatabase();
    memoryRepo = new MemoryRepository(db);
    candidateRepo = new CandidateRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('returns no collision for novel content', () => {
    const result = detectCollision('unique content here', memoryRepo, candidateRepo);
    expect(result.hasCollision).toBe(false);
    expect(result.contentHash).toBeTruthy();
  });

  it('detects collision with curated memory', () => {
    const content = 'This content already exists in curated';
    const hash = computeContentHash(content);
    const memory = makeCuratedMemory({ content, contentHash: hash });
    memoryRepo.insert(memory);

    const result = detectCollision(content, memoryRepo, candidateRepo);
    expect(result.hasCollision).toBe(true);
    expect(result.target).toBe('curated_memory');
    expect(result.matchedId).toBe(memory.id);
  });

  it('detects collision with pending candidate', () => {
    const content = 'This content is already in inbox';
    const hash = computeContentHash(content);
    const candidate = makeCandidate({ content });
    candidateRepo.insert(candidate, hash);

    const result = detectCollision(content, memoryRepo, candidateRepo);
    expect(result.hasCollision).toBe(true);
    expect(result.target).toBe('candidate');
    expect(result.matchedId).toBe(candidate.id);
  });

  it('curated memory takes priority over candidate', () => {
    const content = 'Content in both places';
    const hash = computeContentHash(content);
    const memory = makeCuratedMemory({ content, contentHash: hash });
    memoryRepo.insert(memory);
    const candidate = makeCandidate({ content });
    candidateRepo.insert(candidate, hash);

    const result = detectCollision(content, memoryRepo, candidateRepo);
    expect(result.target).toBe('curated_memory');
    expect(result.matchedId).toBe(memory.id);
  });

  it('detects intra-batch collision via batchHashes', () => {
    const content = 'Duplicate within batch';
    const hash = computeContentHash(content);
    const batchHashes = new Set([hash]);

    const result = detectCollision(content, memoryRepo, candidateRepo, batchHashes);
    expect(result.hasCollision).toBe(true);
    expect(result.target).toBe('candidate');
    expect(result.matchedTitle).toContain('duplicate within this import batch');
  });

  it('always returns the content hash', () => {
    const content = 'Any content at all';
    const expected = computeContentHash(content);

    const result = detectCollision(content, memoryRepo, candidateRepo);
    expect(result.contentHash).toBe(expected);
  });
});
