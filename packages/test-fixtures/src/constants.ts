/**
 * Shared deterministic timestamp used across test suites.
 * Assign to `nowFn: () => FIXED_NOW` for deterministic time injection.
 */
export const FIXED_NOW = '2026-01-15T10:00:00.000Z';

/** Default tenant id used in factory defaults. */
export const DEFAULT_TENANT = 'team-alpha';

/** Pre-computed 64-char hash stubs for tests that need stable hash values. */
export const HASH_A = 'a'.repeat(64);
export const HASH_B = 'b'.repeat(64);

/** Default candidate content string — exported for tests that need to assert on it directly. */
export const DEFAULT_CONTENT = 'Use Result<T, E> for all fallible operations in the codebase';
