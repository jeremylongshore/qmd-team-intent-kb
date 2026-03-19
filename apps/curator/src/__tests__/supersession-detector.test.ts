import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase, MemoryRepository } from '@qmd-team-intent-kb/store';
import {
  detectSupersession,
  computeTitleSimilarity,
} from '../supersession/supersession-detector.js';
import { makeCandidate, makeCuratedMemory, TENANT } from './fixtures.js';

describe('computeTitleSimilarity', () => {
  it('returns 1.0 for identical titles', () => {
    expect(computeTitleSimilarity('Error handling convention', 'Error handling convention')).toBe(
      1.0,
    );
  });

  it('returns 0.0 for completely different titles', () => {
    expect(computeTitleSimilarity('Error handling convention', 'Database schema design')).toBe(0);
  });

  it('returns 1.0 when both strings are empty', () => {
    expect(computeTitleSimilarity('', '')).toBe(1.0);
  });

  it('returns 0.0 when one string is empty and the other is not', () => {
    expect(computeTitleSimilarity('Error handling', '')).toBe(0.0);
    expect(computeTitleSimilarity('', 'Error handling')).toBe(0.0);
  });

  it('is case-insensitive', () => {
    expect(computeTitleSimilarity('Error Handling Convention', 'error handling convention')).toBe(
      1.0,
    );
  });

  it('produces high similarity for overlapping titles', () => {
    // "Error handling patterns" vs "Error handling conventions"
    // tokens A: {error, handling, patterns}
    // tokens B: {error, handling, conventions}
    // intersection: {error, handling} = 2, union = 4, similarity = 0.5
    const sim = computeTitleSimilarity('Error handling patterns', 'Error handling conventions');
    expect(sim).toBeGreaterThan(0.4);
    expect(sim).toBeLessThan(1.0);
  });

  it('treats multi-word phrases as token sets (Jaccard)', () => {
    // "a b c" vs "a b d" → intersection={a,b}, union={a,b,c,d}=4 → 2/4 = 0.5
    expect(computeTitleSimilarity('a b c', 'a b d')).toBeCloseTo(0.5, 5);
  });

  it('handles single-word titles correctly', () => {
    expect(computeTitleSimilarity('Patterns', 'Patterns')).toBe(1.0);
    expect(computeTitleSimilarity('Patterns', 'Conventions')).toBe(0.0);
  });
});

describe('detectSupersession', () => {
  let memoryRepo: MemoryRepository;

  beforeEach(() => {
    const db = createTestDatabase();
    memoryRepo = new MemoryRepository(db);
  });

  it('returns null when no memories exist in store', () => {
    const candidate = makeCandidate({ title: 'Error handling convention', category: 'convention' });
    const result = detectSupersession(candidate, memoryRepo);
    expect(result).toBeNull();
  });

  it('returns null when titles are completely different', () => {
    const existing = makeCuratedMemory({
      title: 'Database schema design principles',
      category: 'convention',
    });
    memoryRepo.insert(existing);

    const candidate = makeCandidate({ title: 'Error handling convention', category: 'convention' });
    const result = detectSupersession(candidate, memoryRepo);
    expect(result).toBeNull();
  });

  it('returns null when category does not match', () => {
    const existing = makeCuratedMemory({
      title: 'Error handling convention',
      category: 'pattern',
    });
    memoryRepo.insert(existing);

    const candidate = makeCandidate({ title: 'Error handling convention', category: 'convention' });
    const result = detectSupersession(candidate, memoryRepo);
    expect(result).toBeNull();
  });

  it('returns null when tenant does not match', () => {
    const existing = makeCuratedMemory({
      title: 'Error handling convention',
      category: 'convention',
      tenantId: 'team-beta',
    });
    memoryRepo.insert(existing);

    const candidate = makeCandidate({
      title: 'Error handling convention',
      category: 'convention',
      tenantId: TENANT,
    });
    const result = detectSupersession(candidate, memoryRepo);
    expect(result).toBeNull();
  });

  it('detects supersession when titles are similar in same category and tenant', () => {
    const existing = makeCuratedMemory({
      title: 'Error handling patterns',
      category: 'convention',
      tenantId: TENANT,
    });
    memoryRepo.insert(existing);

    const candidate = makeCandidate({
      title: 'Error handling conventions',
      category: 'convention',
      tenantId: TENANT,
    });
    // "error handling patterns" vs "error handling conventions": 2 shared / 4 total = 0.5
    // Default threshold is 0.6 — should NOT match
    const resultDefault = detectSupersession(candidate, memoryRepo, 0.6);
    expect(resultDefault).toBeNull();

    // With lower threshold 0.4 — should match
    const resultLow = detectSupersession(candidate, memoryRepo, 0.4);
    expect(resultLow).not.toBeNull();
    expect(resultLow?.supersededMemoryId).toBe(existing.id);
  });

  it('returns the best match when multiple memories have similar titles', () => {
    const existing1 = makeCuratedMemory({
      title: 'Error handling guide',
      category: 'convention',
      tenantId: TENANT,
    });
    const existing2 = makeCuratedMemory({
      title: 'Error handling patterns complete',
      category: 'convention',
      tenantId: TENANT,
    });
    memoryRepo.insert(existing1);
    memoryRepo.insert(existing2);

    // "error handling" vs "error handling guide" = 2/3 ≈ 0.667
    // "error handling" vs "error handling patterns complete" = 2/4 = 0.5
    const candidate = makeCandidate({
      title: 'Error handling',
      category: 'convention',
      tenantId: TENANT,
    });
    const result = detectSupersession(candidate, memoryRepo, 0.5);
    expect(result).not.toBeNull();
    // Best match should be existing1 (higher similarity)
    expect(result?.supersededMemoryId).toBe(existing1.id);
  });

  it('returns supersession match with correct fields', () => {
    const existing = makeCuratedMemory({
      title: 'Error handling convention',
      category: 'convention',
      tenantId: TENANT,
    });
    memoryRepo.insert(existing);

    const candidate = makeCandidate({
      title: 'Error handling convention',
      category: 'convention',
      tenantId: TENANT,
    });
    const result = detectSupersession(candidate, memoryRepo, 0.5);
    expect(result).not.toBeNull();
    expect(result?.supersededMemoryId).toBe(existing.id);
    expect(result?.supersededTitle).toBe('Error handling convention');
    expect(result?.similarity).toBe(1.0);
  });

  it('respects high threshold by requiring very similar titles', () => {
    const existing = makeCuratedMemory({
      title: 'Error handling patterns',
      category: 'convention',
      tenantId: TENANT,
    });
    memoryRepo.insert(existing);

    const candidate = makeCandidate({
      title: 'Error handling guide overview',
      category: 'convention',
      tenantId: TENANT,
    });
    // "error handling patterns" vs "error handling guide overview"
    // A: {error, handling, patterns}, B: {error, handling, guide, overview}
    // intersection=2, union=5, sim=0.4
    const result = detectSupersession(candidate, memoryRepo, 0.9);
    expect(result).toBeNull();
  });

  it('only considers active memories, not superseded ones', () => {
    const existing = makeCuratedMemory({
      title: 'Error handling convention',
      category: 'convention',
      tenantId: TENANT,
      lifecycle: 'superseded',
      supersession: {
        supersededBy: '00000000-0000-4000-8000-000000000001',
        reason: 'Old version',
        linkedAt: '2026-01-15T10:00:00.000Z',
      },
    });
    memoryRepo.insert(existing);

    const candidate = makeCandidate({
      title: 'Error handling convention',
      category: 'convention',
      tenantId: TENANT,
    });
    const result = detectSupersession(candidate, memoryRepo, 0.5);
    expect(result).toBeNull();
  });
});
