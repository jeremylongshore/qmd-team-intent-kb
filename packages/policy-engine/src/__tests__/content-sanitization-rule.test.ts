import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { MemoryCandidate, GovernancePolicy } from '@qmd-team-intent-kb/schema';
import { evaluateContentSanitization } from '../rules/content-sanitization-rule.js';
import type { EvaluationContext } from '../types.js';

function makeCandidate(overrides?: Record<string, unknown>): MemoryCandidate {
  return MemoryCandidate.parse({
    id: randomUUID(),
    status: 'inbox',
    source: 'claude_session',
    content: 'Use dependency injection for all services',
    title: 'DI pattern',
    category: 'pattern',
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
    id: 'rule-content-sanitization',
    type: 'content_sanitization' as const,
    action: 'flag' as const,
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

describe('evaluateContentSanitization', () => {
  it('passes clean content with no internal references', () => {
    const candidate = makeCandidate({
      content: 'Always prefer const over let when the binding is never reassigned.',
    });
    const rule = makeRule();
    const result = evaluateContentSanitization(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('pass');
    expect(result.ruleId).toBe(rule.id);
  });

  it('flags content with /home/user/projects path', () => {
    const candidate = makeCandidate({
      content: 'Run the script from /home/user/projects/setup.sh',
    });
    const rule = makeRule();
    const result = evaluateContentSanitization(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('flag');
    expect(result.reason).toContain('unix-home-path');
  });

  it('flags content with /Users/admin path', () => {
    const candidate = makeCandidate({
      content: 'Dependencies are cached at /Users/admin/Library/Caches',
    });
    const rule = makeRule();
    const result = evaluateContentSanitization(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('flag');
    expect(result.reason).toContain('macos-user-path');
  });

  it('flags content with Windows C:\\ path', () => {
    const candidate = makeCandidate({
      content: 'Installer drops files in C:\\Program Files\\MyApp\\',
    });
    const rule = makeRule();
    const result = evaluateContentSanitization(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('flag');
    expect(result.reason).toContain('windows-path');
  });

  it('flags content with RFC 1918 private IP 192.168.1.1', () => {
    const candidate = makeCandidate({
      content: 'The database server runs at 192.168.1.1:5432',
    });
    const rule = makeRule();
    const result = evaluateContentSanitization(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('flag');
    expect(result.reason).toContain('rfc1918-ip');
  });

  it('flags content with .internal hostname', () => {
    const candidate = makeCandidate({
      content: 'Connect to postgres via server.internal for the staging environment.',
    });
    const rule = makeRule();
    const result = evaluateContentSanitization(candidate, rule, makeContext(candidate));
    expect(result.outcome).toBe('flag');
    expect(result.reason).toContain('internal-hostname');
  });
});
