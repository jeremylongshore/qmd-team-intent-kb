/**
 * API test fixtures.
 *
 * Shared factories are re-exported from @qmd-team-intent-kb/test-fixtures.
 * makeTransitionBody is api-specific and lives here.
 */
export {
  makeCandidate,
  makeMemory,
  makePolicy,
  FIXED_NOW as NOW,
} from '@qmd-team-intent-kb/test-fixtures';

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
