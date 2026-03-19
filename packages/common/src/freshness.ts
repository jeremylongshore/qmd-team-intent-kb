/**
 * Compute a freshness multiplier (0.0–1.0) based on memory age.
 * Uses exponential decay: score = e^(-lambda * ageDays)
 * Default half-life: 90 days (lambda = ln(2)/90 ≈ 0.0077)
 */
export function computeFreshnessScore(
  updatedAt: string,
  nowIso: string,
  halfLifeDays: number = 90,
): number {
  const updatedMs = new Date(updatedAt).getTime();
  const nowMs = new Date(nowIso).getTime();
  const ageDays = Math.max(0, (nowMs - updatedMs) / (1000 * 60 * 60 * 24));
  const lambda = Math.LN2 / halfLifeDays;
  return Math.exp(-lambda * ageDays);
}

/** Category importance weights for search ranking */
export const CATEGORY_BOOST: Record<string, number> = {
  decision: 1.2,
  architecture: 1.15,
  convention: 1.1,
  pattern: 1.1,
  troubleshooting: 1.0,
  onboarding: 0.95,
  reference: 0.9,
};

/**
 * Rerank search hits by combining raw score with freshness and category boost.
 * finalScore = rawScore * freshnessMultiplier * categoryBoost
 * Returns hits sorted by finalScore descending.
 */
export function rerankSearchHits<T extends { score: number; category: string; updatedAt: string }>(
  hits: T[],
  nowIso: string,
  halfLifeDays: number = 90,
): Array<T & { finalScore: number }> {
  return hits
    .map((hit) => {
      const freshness = computeFreshnessScore(hit.updatedAt, nowIso, halfLifeDays);
      const categoryBoost = CATEGORY_BOOST[hit.category] ?? 1.0;
      const finalScore = Math.round(hit.score * freshness * categoryBoost * 1000) / 1000;
      return { ...hit, finalScore };
    })
    .sort((a, b) => b.finalScore - a.finalScore);
}
