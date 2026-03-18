import { randomUUID } from 'node:crypto';
import { CuratedMemory } from '@qmd-team-intent-kb/schema';
import { computeContentHash } from '@qmd-team-intent-kb/common';

export const NOW = '2026-01-15T10:00:00.000Z';
export const LATER = '2026-01-16T10:00:00.000Z';
export const TENANT = 'team-alpha';

/**
 * Build a valid CuratedMemory, merging optional overrides.
 * `contentHash` is computed from the resolved `content` unless explicitly overridden.
 */
export function makeCuratedMemory(overrides?: Record<string, unknown>): CuratedMemory {
  const defaultContent = 'Use dependency injection for all services';
  const base: Record<string, unknown> = {
    id: randomUUID(),
    candidateId: randomUUID(),
    source: 'claude_session',
    content: defaultContent,
    title: 'Dependency injection pattern',
    category: 'pattern',
    trustLevel: 'high',
    sensitivity: 'internal',
    author: { type: 'ai', id: 'claude-1' },
    tenantId: TENANT,
    metadata: { filePaths: [], tags: ['di', 'architecture'] },
    lifecycle: 'active',
    policyEvaluations: [],
    promotedAt: NOW,
    promotedBy: { type: 'system', id: 'curator' },
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };

  const resolvedContent = typeof base['content'] === 'string' ? base['content'] : defaultContent;
  if (base['contentHash'] === undefined) {
    base['contentHash'] = computeContentHash(resolvedContent);
  }

  return CuratedMemory.parse(base);
}
