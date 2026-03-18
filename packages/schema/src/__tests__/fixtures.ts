import { randomUUID } from 'node:crypto';

const NOW = '2026-01-15T10:00:00.000Z';
const HASH = 'a'.repeat(64);

export function makeAuthor(overrides?: Record<string, unknown>): {
  type: string;
  id: string;
  name?: string;
} {
  return {
    type: 'human',
    id: 'user-1',
    name: 'Test User',
    ...overrides,
  };
}

export function makeMemoryCandidate(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: randomUUID(),
    status: 'inbox',
    source: 'claude_session',
    content: 'Use Result<T, E> for all fallible operations',
    title: 'Error handling convention',
    category: 'convention',
    trustLevel: 'medium',
    author: makeAuthor({ type: 'ai', id: 'claude-session-1' }),
    tenantId: 'team-alpha',
    metadata: {},
    prePolicyFlags: {},
    capturedAt: NOW,
    ...overrides,
  };
}

export function makeCuratedMemory(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: randomUUID(),
    candidateId: randomUUID(),
    source: 'claude_session',
    content: 'All API endpoints must validate input with Zod schemas',
    title: 'API input validation pattern',
    category: 'pattern',
    trustLevel: 'high',
    sensitivity: 'internal',
    author: makeAuthor({ type: 'ai', id: 'claude-session-2' }),
    tenantId: 'team-alpha',
    metadata: {},
    lifecycle: 'active',
    contentHash: HASH,
    policyEvaluations: [],
    promotedAt: NOW,
    promotedBy: makeAuthor(),
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

export function makeGovernancePolicy(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: randomUUID(),
    name: 'Default Security Policy',
    tenantId: 'team-alpha',
    rules: [
      {
        id: 'rule-secret-detect',
        type: 'secret_detection',
        action: 'reject',
        enabled: true,
        priority: 0,
        parameters: {},
      },
    ],
    enabled: true,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function makeSearchQuery(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    query: 'error handling',
    ...overrides,
  };
}

export function makeSearchHit(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    memoryId: randomUUID(),
    title: 'Error handling convention',
    snippet: 'Use Result<T, E> for all fallible operations',
    score: 0.85,
    category: 'convention',
    matchedAt: NOW,
    ...overrides,
  };
}

export function makeSearchResult(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    hits: [makeSearchHit()],
    totalCount: 1,
    query: 'error handling',
    scope: 'curated',
    page: 1,
    pageSize: 20,
    hasMore: false,
    ...overrides,
  };
}

export function makeAuditEvent(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: randomUUID(),
    action: 'promoted',
    memoryId: randomUUID(),
    tenantId: 'team-alpha',
    actor: makeAuthor(),
    reason: 'Passed all governance rules',
    details: {},
    timestamp: NOW,
    ...overrides,
  };
}
