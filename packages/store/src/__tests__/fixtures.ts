/**
 * Store-package test fixtures.
 *
 * Shared factories are re-exported from @qmd-team-intent-kb/test-fixtures.
 * makeCandidate here matches the original store signature: returns {candidate, contentHash}.
 * HASH_A / HASH_B are stable hash stubs used in memory-repository tests.
 */
export {
  makeCandidateWithHash as makeCandidate,
  makeMemory,
  makePolicy,
  makeAuditEvent,
  FIXED_NOW as NOW,
  HASH_A,
  HASH_B,
} from '@qmd-team-intent-kb/test-fixtures';
