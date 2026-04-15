import { randomUUID } from 'node:crypto';
import { GovernancePolicy } from '@qmd-team-intent-kb/schema';
import { FIXED_NOW, DEFAULT_TENANT } from './constants.js';

/**
 * Build a valid {@link GovernancePolicy} via Zod parse.
 * Defaults to a single `secret_detection` reject rule — the minimum Zod
 * requires (rules array must be non-empty) and matches the previous
 * per-package defaults the store and curator tests were written against.
 * Pass `overrides.rules = [...]` to supply a different rule set.
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
    ],
    enabled: true,
    version: 1,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  });
}
