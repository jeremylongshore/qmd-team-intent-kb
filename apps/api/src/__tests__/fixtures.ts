import { randomUUID } from 'node:crypto';
import { computeContentHash } from '@qmd-team-intent-kb/common';
import type { CuratedMemory, GovernancePolicy, MemoryCandidate } from '@qmd-team-intent-kb/schema';

export const NOW = '2026-01-15T10:00:00.000Z';
export const HASH_A = 'a'.repeat(64);

/**
 * Build a valid MemoryCandidate request body.
 * All fields are valid by default; pass overrides to test edge cases.
 */
export function makeCandidate(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
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
    prePolicyFlags: {},
    capturedAt: NOW,
    ...overrides,
  };
}

/**
 * Build a valid CuratedMemory for direct repository insertion in tests.
 * Use this when you need a memory to already exist (e.g. transition tests).
 */
export function makeMemory(overrides?: Partial<CuratedMemory>): CuratedMemory {
  const content = 'All API endpoints must validate input with Zod schemas';
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
    tenantId: 'team-alpha',
    metadata: { filePaths: [], tags: [] },
    lifecycle: 'active',
    contentHash: computeContentHash(content),
    policyEvaluations: [],
    promotedAt: NOW,
    promotedBy: { type: 'human', id: 'user-1', name: 'Test User' },
    updatedAt: NOW,
    version: 1,
    ...overrides,
  } satisfies CuratedMemory;
}

/**
 * Build a valid GovernancePolicy request body.
 */
export function makePolicy(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: randomUUID(),
    name: 'Default Security Policy',
    tenantId: 'team-alpha',
    rules: [
      {
        id: 'rule-secret-detect',
        type: 'secret_detection',
        action: 'reject',
        enabled: true,
        priority: 0,
        parameters: {},
      },
    ],
    enabled: true,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

/**
 * Valid TransitionRequest body (without the `to` field, which is handled separately).
 */
export function makeTransitionBody(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    reason: 'No longer needed',
    actor: { type: 'human', id: 'user-1', name: 'Test User' },
    ...overrides,
  };
}

// Re-export for use in tests that need a typed GovernancePolicy
export type { GovernancePolicy, MemoryCandidate };
