import { randomUUID } from 'node:crypto';
import { computeContentHash } from '@qmd-team-intent-kb/common';
import type { CuratedMemory } from '@qmd-team-intent-kb/schema';

export const FIXED_NOW = '2026-01-15T10:00:00.000Z';

export function makeMemory(overrides?: Partial<CuratedMemory>): CuratedMemory {
  const content = overrides?.content ?? 'Use Result<T,E> for fallible operations';
  return {
    id: randomUUID(),
    candidateId: randomUUID(),
    source: 'mcp',
    content,
    title: 'Error handling convention',
    category: 'convention',
    trustLevel: 'high',
    sensitivity: 'internal',
    author: { type: 'ai', id: 'mcp-server' },
    tenantId: 'test-tenant',
    metadata: { filePaths: [], tags: [] },
    lifecycle: 'active',
    contentHash: computeContentHash(content),
    policyEvaluations: [],
    promotedAt: FIXED_NOW,
    promotedBy: { type: 'human', id: 'user-1', name: 'Test User' },
    updatedAt: FIXED_NOW,
    version: 1,
    ...overrides,
  } satisfies CuratedMemory;
}
