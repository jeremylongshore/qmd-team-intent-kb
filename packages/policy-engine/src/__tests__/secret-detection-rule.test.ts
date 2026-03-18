import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { MemoryCandidate, GovernancePolicy } from '@qmd-team-intent-kb/schema';
import { evaluateSecretDetection } from '../rules/secret-detection-rule.js';
import type { EvaluationContext } from '../types.js';

function makeCandidate(overrides?: Record<string, unknown>) {
  return MemoryCandidate.parse({
    id: randomUUID(),
    status: 'inbox',
    source: 'claude_session',
    content: 'Use Result<T, E> for all fallible operations in the codebase',
    title: 'Error handling convention',
    category: 'convention',
    trustLevel: 'medium',
    author: { type: 'ai', id: 'claude-1' },
    tenantId: 'team-alpha',
    metadata: { filePaths: [], tags: [] },
    prePolicyFlags: { potentialSecret: false, lowConfidence: false, duplicateSuspect: false },
    capturedAt: '2026-01-15T10:00:00.000Z',
    ...overrides,
  });
}

function makeRule(overrides?: Record<string, unknown>) {
  return {
    id: 'rule-secret-detection',
    type: 'secret_detection' as const,
    action: 'reject' as const,
    enabled: true,
    priority: 0,
    parameters: {},
    ...overrides,
  };
}

function makeContext(candidate: MemoryCandidate): EvaluationContext {
  return {
    candidate,
    policy: GovernancePolicy.parse({
      id: randomUUID(),
      name: 'Test Policy',
      tenantId: 'team-alpha',
      rules: [makeRule()],
      enabled: true,
      version: 1,
      createdAt: '2026-01-15T10:00:00.000Z',
      updatedAt: '2026-01-15T10:00:00.000Z',
    }),
  };
}

describe('evaluateSecretDetection', () => {
  it('detects JWT tokens in content', () => {
    const content =
      'token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const candidate = makeCandidate({ content });
    const rule = makeRule();
    const result = evaluateSecretDetection(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('fail');
    expect(result.reason).toContain('jwt');
  });

  it('detects AWS access keys', () => {
    const content = 'aws_key = AKIAIOSFODNN7EXAMPLE';
    const candidate = makeCandidate({ content });
    const rule = makeRule();
    const result = evaluateSecretDetection(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('fail');
    expect(result.reason).toContain('aws-key');
  });

  it('detects GitHub tokens', () => {
    const content = 'GITHUB_TOKEN=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij';
    const candidate = makeCandidate({ content });
    const rule = makeRule();
    const result = evaluateSecretDetection(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('fail');
    expect(result.reason).toContain('github-token');
  });

  it('detects generic API keys (sk-*)', () => {
    const content = 'api_key: sk-abcdefghijklmnopqrstuvwxyz';
    const candidate = makeCandidate({ content });
    const rule = makeRule();
    const result = evaluateSecretDetection(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('fail');
    expect(result.reason).toContain('generic-api-key');
  });

  it('passes clean content', () => {
    const candidate = makeCandidate({
      content: 'Use Result<T, E> for all fallible operations in the codebase.',
    });
    const rule = makeRule();
    const result = evaluateSecretDetection(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('pass');
    expect(result.ruleId).toBe(rule.id);
  });

  it('includes pattern ids in failure reason', () => {
    const content = 'AWS_KEY=AKIAIOSFODNN7EXAMPLE';
    const candidate = makeCandidate({ content });
    const rule = makeRule();
    const result = evaluateSecretDetection(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('fail');
    expect(result.reason).toContain('aws-key');
    expect(result.reason).toContain('AWS Access Key');
  });

  it('handles multiple secrets in the same content', () => {
    const content = [
      'AWS_KEY=AKIAIOSFODNN7EXAMPLE',
      'GITHUB_TOKEN=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij',
    ].join('\n');
    const candidate = makeCandidate({ content });
    const rule = makeRule();
    const result = evaluateSecretDetection(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('fail');
    expect(result.reason).toContain('aws-key');
    expect(result.reason).toContain('github-token');
  });

  it('passes content that is effectively clean despite length', () => {
    // Long clean content — should not trigger any pattern
    const content = 'Always use const for variables that are never reassigned. '.repeat(10);
    const candidate = makeCandidate({ content });
    const rule = makeRule();
    const result = evaluateSecretDetection(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('pass');
  });
});
