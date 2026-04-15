import { randomUUID } from 'node:crypto';
import { computeContentHash } from '@qmd-team-intent-kb/common';
import type { CuratedMemory } from '@qmd-team-intent-kb/schema';
import { FIXED_NOW, DEFAULT_TENANT } from './constants.js';

const DEFAULT_CONTENT = 'All API endpoints must validate input with Zod schemas';

/**
 * Build a valid {@link CuratedMemory} with sensible test defaults.
 * Pass `overrides` to customise specific fields.
 *
 * Note: when `overrides.content` is provided the `contentHash` is
 * automatically derived from the overridden content unless `contentHash` is
 * also explicitly overridden.
 */
export function makeMemory(overrides?: Partial<CuratedMemory>): CuratedMemory {
  const content = overrides?.content ?? DEFAULT_CONTENT;
  const contentHash = overrides?.contentHash ?? computeContentHash(content);
  return {
    id: randomUUID(),
    candidateId: randomUUID(),
    source: 'claude_session',
    content,
    title: 'API input validation pattern',
    category: 'pattern',
    trustLevel: 'high',
    sensitivity: 'internal',
    author: { type: 'ai', id: 'claude-session-2', name: 'Claude' },
    tenantId: DEFAULT_TENANT,
    metadata: { filePaths: [], tags: [] },
    lifecycle: 'active',
    contentHash,
    policyEvaluations: [],
    promotedAt: FIXED_NOW,
    promotedBy: { type: 'human', id: 'user-1', name: 'Test User' },
    updatedAt: FIXED_NOW,
    version: 1,
    ...overrides,
  } satisfies CuratedMemory;
}
