import { randomUUID } from 'node:crypto';
import { computeContentHash } from '@qmd-team-intent-kb/common';
import { MemoryCandidate } from '@qmd-team-intent-kb/schema';
import { FIXED_NOW, DEFAULT_TENANT, DEFAULT_CONTENT } from './constants.js';

/**
 * Build a valid {@link MemoryCandidate} via Zod parse so the return value is
 * always structurally sound.  Pass `overrides` to vary specific fields.
 */
export function makeCandidate(overrides?: Record<string, unknown>): MemoryCandidate {
  return MemoryCandidate.parse({
    id: randomUUID(),
    status: 'inbox',
    source: 'claude_session',
    content: DEFAULT_CONTENT,
    title: 'Error handling convention',
    category: 'convention',
    trustLevel: 'medium',
    author: { type: 'ai', id: 'claude-1' },
    tenantId: DEFAULT_TENANT,
    metadata: { filePaths: [], tags: [] },
    prePolicyFlags: { potentialSecret: false, lowConfidence: false, duplicateSuspect: false },
    capturedAt: FIXED_NOW,
    ...overrides,
  });
}

/**
 * Build a valid {@link MemoryCandidate} together with its pre-computed content
 * hash.  Convenient for tests that need to assert on dedup / hash behaviour
 * without re-deriving the hash themselves.
 */
export function makeCandidateWithHash(overrides?: Record<string, unknown>): {
  candidate: MemoryCandidate;
  contentHash: string;
} {
  const candidate = makeCandidate(overrides);
  return { candidate, contentHash: computeContentHash(candidate.content) };
}
