import { randomUUID } from 'node:crypto';
import { MemoryCandidate, CuratedMemory, GovernancePolicy } from '@qmd-team-intent-kb/schema';
import { computeContentHash } from '@qmd-team-intent-kb/common';

const NOW = '2026-01-15T10:00:00.000Z';
export const TENANT = 'team-alpha';

/** Build a valid MemoryCandidate, merging optional overrides */
export function makeCandidate(overrides?: Record<string, unknown>): MemoryCandidate {
  return MemoryCandidate.parse({
    id: randomUUID(),
    status: 'inbox',
    source: 'claude_session',
    content: 'Use Result<T, E> for all fallible operations in the codebase',
    title: 'Error handling convention',
    category: 'convention',
    trustLevel: 'medium',
    author: { type: 'ai', id: 'claude-1' },
    tenantId: TENANT,
    metadata: { filePaths: ['src/utils.ts'], tags: ['error-handling'] },
    prePolicyFlags: {},
    capturedAt: NOW,
    ...overrides,
  });
}

/** Build a valid GovernancePolicy with basic rules, merging optional overrides */
export function makePolicy(overrides?: Record<string, unknown>): GovernancePolicy {
  return GovernancePolicy.parse({
    id: randomUUID(),
    name: 'Test Policy',
    tenantId: TENANT,
    rules: [
      {
        id: 'rule-secret',
        type: 'secret_detection',
        action: 'reject',
        enabled: true,
        priority: 0,
        parameters: {},
      },
      {
        id: 'rule-length',
        type: 'content_length',
        action: 'reject',
        enabled: true,
        priority: 1,
        parameters: { min: 10, max: 50000 },
      },
    ],
    enabled: true,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

/** Build a valid CuratedMemory for seeding the memory store */
export function makeCuratedMemory(overrides?: Record<string, unknown>): CuratedMemory {
  const defaultContent = 'Existing curated content for testing purposes here';
  const base: Record<string, unknown> = {
    id: randomUUID(),
    candidateId: randomUUID(),
    source: 'claude_session',
    content: defaultContent,
    title: 'Existing pattern',
    category: 'pattern',
    trustLevel: 'high',
    sensitivity: 'internal',
    author: { type: 'ai', id: 'claude-1' },
    tenantId: TENANT,
    metadata: {},
    lifecycle: 'active',
    policyEvaluations: [],
    promotedAt: NOW,
    promotedBy: { type: 'system', id: 'curator' },
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
  // Compute contentHash from the resolved content (may have been overridden above)
  const resolvedContent = typeof base['content'] === 'string' ? base['content'] : defaultContent;
  if (base['contentHash'] === undefined) {
    base['contentHash'] = computeContentHash(resolvedContent);
  }
  return CuratedMemory.parse(base);
}
