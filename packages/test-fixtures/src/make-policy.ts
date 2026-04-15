import { randomUUID } from 'node:crypto';
import { GovernancePolicy } from '@qmd-team-intent-kb/schema';
import { FIXED_NOW, DEFAULT_TENANT } from './constants.js';

/**
 * Build a valid {@link GovernancePolicy} via Zod parse.
 * Defaults include both `secret_detection` and `content_length` rules which
 * covers the majority of policy-engine and curator tests.
 * Pass `overrides` to vary specific fields.
 */
export function makePolicy(overrides?: Record<string, unknown>): GovernancePolicy {
  return GovernancePolicy.parse({
    id: randomUUID(),
    name: 'Default Security Policy',
    tenantId: DEFAULT_TENANT,
    rules: [
      {
        id: 'rule-secret-detect',
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
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  });
}
