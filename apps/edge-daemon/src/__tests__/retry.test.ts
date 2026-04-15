import { describe, it, expect, vi } from 'vitest';
import { classifyError, withRetry } from '../retry.js';

describe('classifyError', () => {
  it('classifies ECONNREFUSED as transient', () => {
    const err = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:4000'), {
      code: 'ECONNREFUSED',
    });
    expect(classifyError(err)).toBe('transient');
  });

  it('classifies ETIMEDOUT as transient', () => {
    const err = Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' });
    expect(classifyError(err)).toBe('transient');
  });

  it('classifies qmd not found as transient', () => {
    expect(classifyError(new Error('qmd not found in PATH'))).toBe('transient');
    expect(classifyError(new Error('qmd process not found'))).toBe('transient');
  });

  it('classifies qmd unreachable as transient', () => {
    expect(classifyError(new Error('qmd unreachable'))).toBe('transient');
    expect(classifyError(new Error('qmd service unreachable on port 4000'))).toBe('transient');
  });

  it('classifies non-fast-forward as transient', () => {
    expect(classifyError(new Error('error: failed to push some refs (non-fast-forward)'))).toBe(
      'transient',
    );
  });

  it('classifies failed to push as transient', () => {
    expect(classifyError(new Error('failed to push refs to origin'))).toBe('transient');
  });

  it('classifies generic errors as permanent', () => {
    expect(classifyError(new Error('SyntaxError: unexpected token'))).toBe('permanent');
    expect(classifyError(new Error('ENOENT: no such file'))).toBe('permanent');
    expect(classifyError(new Error('TypeError: cannot read property'))).toBe('permanent');
  });

  it('classifies non-Error values as permanent', () => {
    expect(classifyError('some string error')).toBe('permanent');
    expect(classifyError(42)).toBe('permanent');
    expect(classifyError(null)).toBe('permanent');
  });

  it('requires both qmd + keyword for transient qmd classification', () => {
    expect(classifyError(new Error('not found'))).toBe('permanent');
    expect(classifyError(new Error('unreachable'))).toBe('permanent');
    expect(classifyError(new Error('qmd is great'))).toBe('permanent');
  });
});

describe('withRetry', () => {
  const noopSleep = async (_ms: number) => {};

  it('returns immediately on first-attempt success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 100,
      maxJitterMs: 0,
      sleepFn: noopSleep,
    });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries transient errors up to maxRetries then succeeds', async () => {
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls < 3) {
        const err = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
        throw err;
      }
      return 'done';
    });

    const result = await withRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 10,
      maxJitterMs: 0,
      sleepFn,
    });

    expect(result).toBe('done');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleepFn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting all retries on persistent transient error', async () => {
    const err = Object.assign(new Error('qmd unreachable'), { code: undefined });
    const fn = vi.fn().mockRejectedValue(err);

    await expect(
      withRetry(fn, {
        maxRetries: 2,
        baseDelayMs: 10,
        maxJitterMs: 0,
        sleepFn: noopSleep,
      }),
    ).rejects.toThrow('qmd unreachable');

    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('does not retry permanent errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('SyntaxError: bad json'));

    await expect(
      withRetry(fn, {
        maxRetries: 3,
        baseDelayMs: 10,
        maxJitterMs: 0,
        sleepFn: noopSleep,
      }),
    ).rejects.toThrow('SyntaxError: bad json');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('applies exponential backoff delays between retries', async () => {
    const sleepCalls: number[] = [];
    const sleepFn = async (ms: number) => {
      sleepCalls.push(ms);
    };

    const err = Object.assign(new Error('qmd not found'), {});
    const fn = vi.fn().mockRejectedValue(err);

    await expect(
      withRetry(fn, {
        maxRetries: 3,
        baseDelayMs: 100,
        maxJitterMs: 0,
        sleepFn,
      }),
    ).rejects.toThrow();

    expect(sleepCalls).toHaveLength(3);
    expect(sleepCalls[0]).toBe(100); // 100 * 2^0
    expect(sleepCalls[1]).toBe(200); // 100 * 2^1
    expect(sleepCalls[2]).toBe(400); // 100 * 2^2
  });

  it('adds jitter within expected range', async () => {
    const sleepCalls: number[] = [];
    const sleepFn = async (ms: number) => {
      sleepCalls.push(ms);
    };

    const err = Object.assign(new Error('failed to push refs'), {});
    const fn = vi.fn().mockRejectedValue(err);

    await expect(
      withRetry(fn, {
        maxRetries: 1,
        baseDelayMs: 100,
        maxJitterMs: 50,
        sleepFn,
      }),
    ).rejects.toThrow();

    expect(sleepCalls).toHaveLength(1);
    expect(sleepCalls[0]).toBeGreaterThanOrEqual(100);
    expect(sleepCalls[0]).toBeLessThanOrEqual(150);
  });

  it('flaky mock: fails N-1 times then succeeds', async () => {
    const maxRetries = 4;
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    let attempt = 0;

    const flaky = vi.fn().mockImplementation(async () => {
      attempt++;
      if (attempt < maxRetries) {
        throw Object.assign(new Error('qmd unreachable'), {});
      }
      return `success on attempt ${attempt}`;
    });

    const result = await withRetry(flaky, {
      maxRetries,
      baseDelayMs: 1,
      maxJitterMs: 0,
      sleepFn,
    });

    expect(result).toBe(`success on attempt ${maxRetries}`);
    expect(flaky).toHaveBeenCalledTimes(maxRetries);
    expect(sleepFn).toHaveBeenCalledTimes(maxRetries - 1);
  });
});
