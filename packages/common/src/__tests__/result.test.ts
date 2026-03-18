import { describe, it, expect } from 'vitest';
import { ok, err } from '../result.js';
import type { Result } from '../result.js';

describe('Result', () => {
  it('ok() creates a successful result', () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(42);
    }
  });

  it('err() creates a failed result', () => {
    const result = err(new Error('boom'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('boom');
    }
  });

  it('err() accepts string errors', () => {
    const result: Result<number, string> = err('not found');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('not found');
    }
  });

  it('narrows types correctly via discriminant', () => {
    const result: Result<string, Error> = ok('hello');
    if (result.ok) {
      const val: string = result.value;
      expect(val).toBe('hello');
    } else {
      // Should not reach here
      expect.unreachable();
    }
  });
});
