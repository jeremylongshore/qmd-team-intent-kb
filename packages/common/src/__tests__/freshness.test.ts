import { describe, it, expect } from 'vitest';
import { computeFreshnessScore, CATEGORY_BOOST, rerankSearchHits } from '../freshness.js';

const NOW = '2026-03-19T00:00:00.000Z';

/** Shift NOW by a given number of days into the past */
function daysAgo(days: number): string {
  const ms = new Date(NOW).getTime() - days * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

describe('computeFreshnessScore', () => {
  it('returns 1.0 for same-day content (age = 0)', () => {
    const score = computeFreshnessScore(NOW, NOW);
    expect(score).toBe(1.0);
  });

  it('returns ~0.5 at the default 90-day half-life', () => {
    const score = computeFreshnessScore(daysAgo(90), NOW);
    expect(score).toBeCloseTo(0.5, 5);
  });

  it('returns close to 0 for content older than 365 days', () => {
    const score = computeFreshnessScore(daysAgo(365), NOW);
    // e^(-ln2/90 * 365) ≈ 0.059
    expect(score).toBeLessThan(0.07);
    expect(score).toBeGreaterThan(0);
  });

  it('honours a custom half-life (30 days)', () => {
    const score = computeFreshnessScore(daysAgo(30), NOW, 30);
    expect(score).toBeCloseTo(0.5, 5);
  });

  it('clamps to 1.0 when updatedAt is in the future', () => {
    const future = new Date(new Date(NOW).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const score = computeFreshnessScore(future, NOW);
    expect(score).toBe(1.0);
  });

  it('decreases monotonically as age increases', () => {
    const ages = [0, 30, 90, 180, 365];
    const scores = ages.map((d) => computeFreshnessScore(daysAgo(d), NOW));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThan(scores[i - 1]!);
    }
  });
});

describe('CATEGORY_BOOST', () => {
  it('contains all expected category keys', () => {
    const expectedKeys = [
      'decision',
      'architecture',
      'convention',
      'pattern',
      'troubleshooting',
      'onboarding',
      'reference',
    ];
    for (const key of expectedKeys) {
      expect(CATEGORY_BOOST).toHaveProperty(key);
    }
  });

  it('gives decision the highest boost at 1.2', () => {
    const maxBoost = Math.max(...Object.values(CATEGORY_BOOST));
    expect(CATEGORY_BOOST['decision']).toBe(1.2);
    expect(CATEGORY_BOOST['decision']).toBe(maxBoost);
  });
});

describe('rerankSearchHits', () => {
  it('sorts hits by finalScore descending', () => {
    const hits = [
      { score: 1.0, category: 'reference', updatedAt: daysAgo(180) },
      { score: 1.0, category: 'decision', updatedAt: daysAgo(10) },
      { score: 1.0, category: 'convention', updatedAt: daysAgo(60) },
    ];
    const result = rerankSearchHits(hits, NOW);
    expect(result[0]!.finalScore).toBeGreaterThanOrEqual(result[1]!.finalScore);
    expect(result[1]!.finalScore).toBeGreaterThanOrEqual(result[2]!.finalScore);
  });

  it('ranks newest content first when all raw scores and categories are equal', () => {
    const hits = [
      { score: 1.0, category: 'troubleshooting', updatedAt: daysAgo(90) },
      { score: 1.0, category: 'troubleshooting', updatedAt: daysAgo(10) },
      { score: 1.0, category: 'troubleshooting', updatedAt: daysAgo(180) },
    ];
    const result = rerankSearchHits(hits, NOW);
    // Newest (10 days) should rank first, oldest (180 days) should rank last
    expect(result[0]!.updatedAt).toBe(daysAgo(10));
    expect(result[2]!.updatedAt).toBe(daysAgo(180));
  });

  it('applies a 1.0 boost for unknown categories', () => {
    const hits = [
      { score: 1.0, category: 'unknown-category', updatedAt: NOW },
      { score: 1.0, category: 'troubleshooting', updatedAt: NOW },
    ];
    const result = rerankSearchHits(hits, NOW);
    // troubleshooting boost is 1.0, unknown is also 1.0 — both equal
    expect(result[0]!.finalScore).toBe(result[1]!.finalScore);
  });

  it('returns an empty array when given an empty input', () => {
    const result = rerankSearchHits([], NOW);
    expect(result).toEqual([]);
  });
});
