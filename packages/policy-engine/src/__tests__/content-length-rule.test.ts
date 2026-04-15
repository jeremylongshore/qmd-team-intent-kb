import { describe, it, expect } from 'vitest';
import { evaluateContentLength } from '../rules/content-length-rule.js';
import { makeCandidate, makeContext } from './fixtures.js';

function makeRule(parameters: Record<string, unknown> = {}) {
  return {
    id: 'rule-content-length',
    type: 'content_length' as const,
    action: 'reject' as const,
    enabled: true,
    priority: 0,
    parameters,
  };
}

describe('evaluateContentLength', () => {
  it('rejects content below default minimum length', () => {
    // Default min is 10; provide 5 chars
    const candidate = makeCandidate({ content: 'short' });
    const rule = makeRule();
    const result = evaluateContentLength(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('fail');
    expect(result.reason).toContain('too short');
    expect(result.reason).toContain('5');
    expect(result.reason).toContain('10');
  });

  it('rejects content above default maximum length', () => {
    // Default max is 50000; provide 50001 chars
    const content = 'x'.repeat(50001);
    const candidate = makeCandidate({ content });
    const rule = makeRule();
    const result = evaluateContentLength(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('fail');
    expect(result.reason).toContain('too long');
    expect(result.reason).toContain('50001');
    expect(result.reason).toContain('50000');
  });

  it('passes content within default bounds', () => {
    const content = 'Use Result<T, E> for all fallible operations in the codebase';
    const candidate = makeCandidate({ content });
    const rule = makeRule();
    const result = evaluateContentLength(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('pass');
    expect(result.score).toBeDefined();
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('uses default min=10 max=50000 when parameters are empty', () => {
    // Exactly 10 chars — on the boundary, should pass
    const candidate = makeCandidate({ content: '0123456789' });
    const rule = makeRule({});
    const result = evaluateContentLength(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('pass');
  });

  it('respects custom min parameter', () => {
    // content is 20 chars, custom min is 50 — should fail
    const content = 'exactly twenty chars!';
    const candidate = makeCandidate({ content });
    const rule = makeRule({ min: 50 });
    const result = evaluateContentLength(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('fail');
    expect(result.reason).toContain('50');
  });

  it('respects custom max parameter', () => {
    // content is 100 chars, custom max is 50 — should fail
    const content = 'x'.repeat(100);
    const candidate = makeCandidate({ content });
    const rule = makeRule({ max: 50 });
    const result = evaluateContentLength(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('fail');
    expect(result.reason).toContain('50');
  });

  it('returns normalized score equal to content.length / max on pass', () => {
    // Use custom max=1000 and content of length 500 — score should be 0.5
    const content = 'x'.repeat(500);
    const candidate = makeCandidate({ content });
    const rule = makeRule({ min: 10, max: 1000 });
    const result = evaluateContentLength(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('pass');
    expect(result.score).toBeCloseTo(0.5, 5);
  });
});
