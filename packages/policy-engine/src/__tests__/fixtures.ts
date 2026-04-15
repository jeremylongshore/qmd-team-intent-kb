import { randomUUID } from 'node:crypto';
import { GovernancePolicy } from '@qmd-team-intent-kb/schema';
import type { MemoryCandidate } from '@qmd-team-intent-kb/schema';
import type { EvaluationContext } from '../types.js';
import { FIXED_NOW, DEFAULT_TENANT } from '@qmd-team-intent-kb/test-fixtures';

export {
  makeCandidate,
  FIXED_NOW,
  DEFAULT_TENANT,
  DEFAULT_CONTENT,
} from '@qmd-team-intent-kb/test-fixtures';

interface MakeContextOptions {
  /** Extra hashes for dedup-check tests */
  existingHashes?: Set<string>;
  /** Context-level tenantId for tenant-match tests */
  tenantId?: string;
}

/**
 * Build a minimal EvaluationContext wrapping the given candidate and policy.
 * Pass `options.existingHashes` for dedup-check tests.
 * Pass `options.tenantId` for tenant-match tests.
 *
 * This helper is policy-engine specific and is intentionally not part of the
 * shared test-fixtures package.
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
