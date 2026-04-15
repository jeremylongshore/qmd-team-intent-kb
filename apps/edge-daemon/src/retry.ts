import { setTimeout } from 'node:timers/promises';

type ErrorClass = 'transient' | 'permanent';

/**
 * Classify an error as transient (eligible for retry) or permanent.
 *
 * Transient criteria:
 *   - Node network errors: ECONNREFUSED, ETIMEDOUT
 *   - qmd-unreachable: message contains "qmd" and ("not found" or "unreachable")
 *   - Git push conflicts: message contains "non-fast-forward" or "failed to push"
 */
export function classifyError(err: unknown): ErrorClass {
  const msg = err instanceof Error ? err.message : String(err);
  const code =
    err != null && typeof err === 'object' ? ((err as NodeJS.ErrnoException).code ?? '') : '';

  if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT') return 'transient';

  const lower = msg.toLowerCase();
  if (lower.includes('qmd') && (lower.includes('not found') || lower.includes('unreachable'))) {
    return 'transient';
  }
  if (lower.includes('non-fast-forward') || lower.includes('failed to push')) {
    return 'transient';
  }

  return 'permanent';
}

interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxJitterMs: number;
  sleepFn?: (ms: number) => Promise<void>;
}

/**
 * Execute `fn` with exponential backoff + uniform random jitter on transient errors.
 *
 * Backoff formula: delay = baseDelayMs * 2^attempt + rand(0, maxJitterMs)
 * Permanent errors are rethrown immediately without retry.
 * Throws the last error after maxRetries exhausted.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const sleep = opts.sleepFn ?? ((ms: number) => setTimeout(ms));
  let lastErr: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (classifyError(err) === 'permanent') throw err;
      if (attempt === opts.maxRetries) break;

      const backoff = opts.baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * (opts.maxJitterMs + 1));
      await sleep(backoff + jitter);
    }
  }

  throw lastErr;
}
