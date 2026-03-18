import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { CuratedMemory, PolicyEvaluation, SupersessionLink } from '../curated-memory.js';
import { makeCuratedMemory } from './fixtures.js';

const NOW = '2026-01-15T10:00:00.000Z';

describe('PolicyEvaluation', () => {
  it('parses valid evaluation', () => {
    const result = PolicyEvaluation.parse({
      policyId: randomUUID(),
      ruleId: 'rule-1',
      result: 'pass',
      evaluatedAt: NOW,
    });
    expect(result.result).toBe('pass');
  });

  it('accepts optional reason', () => {
    const result = PolicyEvaluation.parse({
      policyId: randomUUID(),
      ruleId: 'rule-1',
      result: 'fail',
      reason: 'Secret detected',
      evaluatedAt: NOW,
    });
    expect(result.reason).toBe('Secret detected');
  });

  it('rejects invalid result', () => {
    expect(() =>
      PolicyEvaluation.parse({
        policyId: randomUUID(),
        ruleId: 'rule-1',
        result: 'skip',
        evaluatedAt: NOW,
      }),
    ).toThrow();
  });
});

describe('SupersessionLink', () => {
  it('parses valid link', () => {
    const result = SupersessionLink.parse({
      supersededBy: randomUUID(),
      reason: 'Updated with new API pattern',
      linkedAt: NOW,
    });
    expect(result.reason).toBe('Updated with new API pattern');
  });

  it('rejects empty reason', () => {
    expect(() =>
      SupersessionLink.parse({
        supersededBy: randomUUID(),
        reason: '',
        linkedAt: NOW,
      }),
    ).toThrow();
  });
});

describe('CuratedMemory', () => {
  it('parses a valid active memory', () => {
    const input = makeCuratedMemory();
    const result = CuratedMemory.parse(input);
    expect(result.lifecycle).toBe('active');
    expect(result.version).toBe(1);
  });

  it('defaults sensitivity to internal', () => {
    const input = makeCuratedMemory();
    delete (input as Record<string, unknown>)['sensitivity'];
    const result = CuratedMemory.parse(input);
    expect(result.sensitivity).toBe('internal');
  });

  it('defaults version to 1', () => {
    const input = makeCuratedMemory();
    delete (input as Record<string, unknown>)['version'];
    const result = CuratedMemory.parse(input);
    expect(result.version).toBe(1);
  });

  it('defaults policyEvaluations to empty array', () => {
    const input = makeCuratedMemory();
    delete (input as Record<string, unknown>)['policyEvaluations'];
    const result = CuratedMemory.parse(input);
    expect(result.policyEvaluations).toEqual([]);
  });

  it('accepts superseded lifecycle with supersession link', () => {
    const result = CuratedMemory.parse(
      makeCuratedMemory({
        lifecycle: 'superseded',
        supersession: {
          supersededBy: randomUUID(),
          reason: 'Replaced by updated pattern',
          linkedAt: NOW,
        },
      }),
    );
    expect(result.lifecycle).toBe('superseded');
    expect(result.supersession).toBeDefined();
  });

  it('rejects superseded lifecycle without supersession link', () => {
    expect(() =>
      CuratedMemory.parse(
        makeCuratedMemory({
          lifecycle: 'superseded',
          supersession: undefined,
        }),
      ),
    ).toThrow('supersession must be defined');
  });

  it('accepts active lifecycle without supersession', () => {
    const result = CuratedMemory.parse(makeCuratedMemory({ lifecycle: 'active' }));
    expect(result.supersession).toBeUndefined();
  });

  it('accepts deprecated lifecycle without supersession', () => {
    const result = CuratedMemory.parse(makeCuratedMemory({ lifecycle: 'deprecated' }));
    expect(result.lifecycle).toBe('deprecated');
  });

  it('accepts archived lifecycle without supersession', () => {
    const result = CuratedMemory.parse(makeCuratedMemory({ lifecycle: 'archived' }));
    expect(result.lifecycle).toBe('archived');
  });

  it('rejects missing required fields', () => {
    expect(() => CuratedMemory.parse({})).toThrow();
  });

  it('rejects empty content', () => {
    expect(() => CuratedMemory.parse(makeCuratedMemory({ content: '' }))).toThrow();
  });

  it('rejects invalid contentHash', () => {
    expect(() => CuratedMemory.parse(makeCuratedMemory({ contentHash: 'short' }))).toThrow();
  });

  it('rejects non-positive version', () => {
    expect(() => CuratedMemory.parse(makeCuratedMemory({ version: 0 }))).toThrow();
    expect(() => CuratedMemory.parse(makeCuratedMemory({ version: -1 }))).toThrow();
  });

  it('accepts version > 1', () => {
    const result = CuratedMemory.parse(makeCuratedMemory({ version: 5 }));
    expect(result.version).toBe(5);
  });

  it('preserves all policy evaluations', () => {
    const evals = [
      {
        policyId: randomUUID(),
        ruleId: 'rule-1',
        result: 'pass' as const,
        evaluatedAt: NOW,
      },
      {
        policyId: randomUUID(),
        ruleId: 'rule-2',
        result: 'flag' as const,
        reason: 'Low confidence',
        evaluatedAt: NOW,
      },
    ];
    const result = CuratedMemory.parse(makeCuratedMemory({ policyEvaluations: evals }));
    expect(result.policyEvaluations).toHaveLength(2);
  });

  it('rejects invalid lifecycle state', () => {
    expect(() =>
      CuratedMemory.parse(makeCuratedMemory({ lifecycle: 'draft' as 'active' })),
    ).toThrow();
  });
});
