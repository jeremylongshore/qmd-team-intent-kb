import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { MemoryCandidate, GovernancePolicy } from '@qmd-team-intent-kb/schema';
import { evaluateRelevanceScore } from '../rules/relevance-score-rule.js';
import type { EvaluationContext } from '../types.js';

function makeCandidate(overrides?: Record<string, unknown>) {
  return MemoryCandidate.parse({
    id: randomUUID(),
    status: 'inbox',
    source: 'claude_session',
    content: 'Use Result<T, E> for all fallible operations in the codebase',
    title: 'Error handling convention',
    category: 'convention',
    trustLevel: 'medium',
    author: { type: 'ai', id: 'claude-1' },
    tenantId: 'team-alpha',
    metadata: { filePaths: [], tags: [] },
    prePolicyFlags: { potentialSecret: false, lowConfidence: false, duplicateSuspect: false },
    capturedAt: '2026-01-15T10:00:00.000Z',
    ...overrides,
  });
}

function makeRule(parameters: Record<string, unknown> = {}) {
  return {
    id: 'rule-relevance-score',
    type: 'relevance_score' as const,
    action: 'flag' as const,
    enabled: true,
    priority: 0,
    parameters,
  };
}

function makeContext(candidate: MemoryCandidate): EvaluationContext {
  return {
    candidate,
    policy: GovernancePolicy.parse({
      id: randomUUID(),
      name: 'Test Policy',
      tenantId: 'team-alpha',
      rules: [makeRule()],
      enabled: true,
      version: 1,
      createdAt: '2026-01-15T10:00:00.000Z',
      updatedAt: '2026-01-15T10:00:00.000Z',
    }),
  };
}

describe('evaluateRelevanceScore', () => {
  it('scores 1.0 for a fully decorated candidate', () => {
    const candidate = makeCandidate({
      title: 'Full metadata candidate',
      // content > 50 chars (default is already 59 chars)
      content: 'Use Result<T, E> for all fallible operations in the codebase',
      category: 'convention',
      trustLevel: 'high',
      metadata: {
        filePaths: ['src/utils.ts'],
        projectContext: 'main-api',
        tags: ['typescript'],
      },
    });
    const rule = makeRule({ minimumScore: 0.0 });
    const result = evaluateRelevanceScore(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('pass');
    // All 7 criteria met: 0.3 + 0.2 + 0.1 + 0.1 + 0.1 + 0.1 + 0.1 = 1.0
    expect(result.score).toBeCloseTo(1.0, 5);
  });

  it('scores low for bare minimum candidate', () => {
    // Minimal: short content (<=50 chars), no filePaths, no tags, no projectContext, not high trust
    const candidate = makeCandidate({
      title: 'minimal',
      content: 'Short content here.', // 19 chars, <=50
      category: 'reference',
      trustLevel: 'low',
      metadata: { filePaths: [], tags: [] },
    });
    const rule = makeRule({ minimumScore: 0.0 });
    const result = evaluateRelevanceScore(candidate, rule, makeContext(candidate));
    // Only title (+0.3) and category (+0.1) contribute → 0.4
    expect(result.score).toBeCloseTo(0.4, 5);
  });

  it('title adds 0.3 to score', () => {
    // Start with a candidate with no other contributing factors beyond title and category
    const candidateWithTitle = makeCandidate({
      title: 'My title',
      content: 'Short.', // <=50 chars
      category: 'reference',
      trustLevel: 'low',
      metadata: { filePaths: [], tags: [] },
    });
    const rule = makeRule({ minimumScore: 0.0 });
    const result = evaluateRelevanceScore(
      candidateWithTitle,
      rule,
      makeContext(candidateWithTitle),
    );
    // title=0.3, category=0.1, total=0.4
    expect(result.score).toBeCloseTo(0.4, 5);
  });

  it('content length > 50 chars adds 0.2', () => {
    const longContent = 'x'.repeat(51);
    const candidate = makeCandidate({
      title: 'T',
      content: longContent,
      category: 'reference',
      trustLevel: 'low',
      metadata: { filePaths: [], tags: [] },
    });
    const rule = makeRule({ minimumScore: 0.0 });
    const result = evaluateRelevanceScore(candidate, rule, makeContext(candidate));
    // title=0.3, content>50=0.2, category=0.1 → 0.6
    expect(result.score).toBeCloseTo(0.6, 5);
  });

  it('filePaths add 0.1 to score', () => {
    const candidate = makeCandidate({
      title: 'T',
      content: 'Short.', // <=50 chars
      category: 'reference',
      trustLevel: 'low',
      metadata: { filePaths: ['src/index.ts'], tags: [] },
    });
    const rule = makeRule({ minimumScore: 0.0 });
    const result = evaluateRelevanceScore(candidate, rule, makeContext(candidate));
    // title=0.3, category=0.1, filePaths=0.1 → 0.5
    expect(result.score).toBeCloseTo(0.5, 5);
  });

  it('tags add 0.1 to score', () => {
    const candidate = makeCandidate({
      title: 'T',
      content: 'Short.', // <=50 chars
      category: 'reference',
      trustLevel: 'low',
      metadata: { filePaths: [], tags: ['typescript'] },
    });
    const rule = makeRule({ minimumScore: 0.0 });
    const result = evaluateRelevanceScore(candidate, rule, makeContext(candidate));
    // title=0.3, category=0.1, tags=0.1 → 0.5
    expect(result.score).toBeCloseTo(0.5, 5);
  });

  it('high trust adds 0.1 to score', () => {
    const candidate = makeCandidate({
      title: 'T',
      content: 'Short.', // <=50 chars
      category: 'reference',
      trustLevel: 'high',
      metadata: { filePaths: [], tags: [] },
    });
    const rule = makeRule({ minimumScore: 0.0 });
    const result = evaluateRelevanceScore(candidate, rule, makeContext(candidate));
    // title=0.3, category=0.1, high trust=0.1 → 0.5
    expect(result.score).toBeCloseTo(0.5, 5);
  });

  it('flags when score is below minimumScore threshold', () => {
    // Score will be 0.4 (title + category only), minimum is 0.8
    const candidate = makeCandidate({
      title: 'minimal',
      content: 'Short.', // <=50 chars
      category: 'reference',
      trustLevel: 'low',
      metadata: { filePaths: [], tags: [] },
    });
    const rule = makeRule({ minimumScore: 0.8 });
    const result = evaluateRelevanceScore(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('flag');
    expect(result.reason).toContain('below minimum');
  });
});
