import { describe, it, expect } from 'vitest';
import { SECRET_PATTERNS } from '../secrets/patterns.js';

describe('SECRET_PATTERNS', () => {
  it('has 11 patterns', () => {
    expect(SECRET_PATTERNS).toHaveLength(11);
  });

  it('each pattern has required fields', () => {
    for (const p of SECRET_PATTERNS) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.regex).toBeInstanceOf(RegExp);
      expect(p.description).toBeTruthy();
    }
  });

  it('all pattern IDs are unique', () => {
    const ids = SECRET_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
