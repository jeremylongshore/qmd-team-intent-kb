import { describe, it, expect } from 'vitest';
import { GovernancePolicy, PolicyRule } from '../governance-policy.js';
import { makeGovernancePolicy } from './fixtures.js';

describe('PolicyRule', () => {
  it('parses valid rule', () => {
    const result = PolicyRule.parse({
      id: 'rule-1',
      type: 'secret_detection',
      action: 'reject',
    });
    expect(result.enabled).toBe(true);
    expect(result.priority).toBe(0);
    expect(result.parameters).toEqual({});
  });

  it('accepts all rule types', () => {
    const types = [
      'secret_detection',
      'dedup_check',
      'relevance_score',
      'content_length',
      'source_trust',
      'tenant_match',
    ] as const;
    for (const type of types) {
      expect(PolicyRule.parse({ id: 'r', type, action: 'approve' }).type).toBe(type);
    }
  });

  it('accepts all actions', () => {
    const actions = ['reject', 'flag', 'approve', 'require_review'] as const;
    for (const action of actions) {
      expect(PolicyRule.parse({ id: 'r', type: 'dedup_check', action }).action).toBe(action);
    }
  });

  it('accepts custom parameters', () => {
    const result = PolicyRule.parse({
      id: 'rule-dedup',
      type: 'dedup_check',
      action: 'flag',
      parameters: { threshold: 0.8, algorithm: 'cosine' },
    });
    expect(result.parameters).toEqual({ threshold: 0.8, algorithm: 'cosine' });
  });

  it('rejects missing id', () => {
    expect(() => PolicyRule.parse({ type: 'secret_detection', action: 'reject' })).toThrow();
  });

  it('rejects invalid type', () => {
    expect(() => PolicyRule.parse({ id: 'r', type: 'custom_rule', action: 'reject' })).toThrow();
  });

  it('rejects negative priority', () => {
    expect(() =>
      PolicyRule.parse({ id: 'r', type: 'dedup_check', action: 'flag', priority: -1 }),
    ).toThrow();
  });
});

describe('GovernancePolicy', () => {
  it('parses a valid policy', () => {
    const input = makeGovernancePolicy();
    const result = GovernancePolicy.parse(input);
    expect(result.name).toBe('Default Security Policy');
    expect(result.rules).toHaveLength(1);
    expect(result.enabled).toBe(true);
  });

  it('requires at least one rule', () => {
    expect(() => GovernancePolicy.parse(makeGovernancePolicy({ rules: [] }))).toThrow();
  });

  it('accepts multiple rules', () => {
    const result = GovernancePolicy.parse(
      makeGovernancePolicy({
        rules: [
          { id: 'r1', type: 'secret_detection', action: 'reject' },
          { id: 'r2', type: 'dedup_check', action: 'flag', priority: 1 },
          { id: 'r3', type: 'content_length', action: 'approve', priority: 2 },
        ],
      }),
    );
    expect(result.rules).toHaveLength(3);
  });

  it('defaults enabled to true', () => {
    const input = makeGovernancePolicy();
    delete (input as Record<string, unknown>)['enabled'];
    const result = GovernancePolicy.parse(input);
    expect(result.enabled).toBe(true);
  });

  it('defaults version to 1', () => {
    const input = makeGovernancePolicy();
    delete (input as Record<string, unknown>)['version'];
    const result = GovernancePolicy.parse(input);
    expect(result.version).toBe(1);
  });

  it('rejects missing name', () => {
    const input = makeGovernancePolicy();
    delete (input as Record<string, unknown>)['name'];
    expect(() => GovernancePolicy.parse(input)).toThrow();
  });

  it('rejects missing tenantId', () => {
    const input = makeGovernancePolicy();
    delete (input as Record<string, unknown>)['tenantId'];
    expect(() => GovernancePolicy.parse(input)).toThrow();
  });

  it('rejects non-positive version', () => {
    expect(() => GovernancePolicy.parse(makeGovernancePolicy({ version: 0 }))).toThrow();
  });
});
