import { randomUUID } from 'node:crypto';
import { MemoryCandidate, GovernancePolicy } from '@qmd-team-intent-kb/schema';
import type { EvaluationContext } from '../types.js';

export const FIXED_NOW = '2026-01-15T10:00:00.000Z';
export const DEFAULT_TENANT = 'team-alpha';
export const DEFAULT_CONTENT = 'Use Result<T, E> for all fallible operations in the codebase';

/**
 * Build a valid MemoryCandidate for policy-engine rule tests.
 * All fields are valid defaults; pass overrides to vary specific properties.
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

export interface MakeContextOptions {
  /** Extra hashes for dedup-check tests */
  existingHashes?: Set<string>;
  /** Context-level tenantId for tenant-match tests */
  tenantId?: string;
}

/**
 * Build a minimal EvaluationContext wrapping the given candidate and policy.
 * Pass `options.existingHashes` for dedup-check tests.
 * Pass `options.tenantId` for tenant-match tests.
 */
export function makeContext(
  candidate: MemoryCandidate,
  options: MakeContextOptions = {},
): EvaluationContext {
  return {
    candidate,
    policy: GovernancePolicy.parse({
      id: randomUUID(),
      name: 'Test Policy',
      tenantId: DEFAULT_TENANT,
      rules: [
        {
          id: 'rule-placeholder',
          type: 'content_length',
          action: 'reject',
          enabled: true,
          priority: 0,
          parameters: {},
        },
      ],
      enabled: true,
      version: 1,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    }),
    existingHashes: options.existingHashes,
    tenantId: options.tenantId,
  };
}
