import { randomUUID } from 'node:crypto';
import { computeContentHash } from '@qmd-team-intent-kb/common';
import type {
  MemoryCandidate,
  CuratedMemory,
  GovernancePolicy,
  AuditEvent,
} from '@qmd-team-intent-kb/schema';

export const NOW = '2026-01-15T10:00:00.000Z';
export const HASH_A = 'a'.repeat(64);
export const HASH_B = 'b'.repeat(64);

export function makeCandidate(overrides?: Partial<MemoryCandidate>): {
  candidate: MemoryCandidate;
  contentHash: string;
} {
  const content = overrides?.content ?? 'Use Result<T, E> for all fallible operations';
  const candidate: MemoryCandidate = {
    id: randomUUID(),
    status: 'inbox',
    source: 'claude_session',
    content,
    title: 'Error handling convention',
    category: 'convention',
    trustLevel: 'medium',
    author: { type: 'ai', id: 'claude-session-1', name: 'Claude' },
    tenantId: 'team-alpha',
    metadata: { filePaths: [], tags: [] },
    prePolicyFlags: { potentialSecret: false, lowConfidence: false, duplicateSuspect: false },
    capturedAt: NOW,
    ...overrides,
  };
  return { candidate, contentHash: computeContentHash(content) };
}

export function makeMemory(overrides?: Partial<CuratedMemory>): CuratedMemory {
  return {
    id: randomUUID(),
    candidateId: randomUUID(),
    source: 'claude_session',
    content: 'All API endpoints must validate input with Zod schemas',
    title: 'API input validation pattern',
    category: 'pattern',
    trustLevel: 'high',
    sensitivity: 'internal',
    author: { type: 'ai', id: 'claude-session-2', name: 'Claude' },
    tenantId: 'team-alpha',
    metadata: { filePaths: [], tags: [] },
    lifecycle: 'active',
    contentHash: HASH_A,
    policyEvaluations: [],
    promotedAt: NOW,
    promotedBy: { type: 'human', id: 'user-1', name: 'Test User' },
    updatedAt: NOW,
    version: 1,
    ...overrides,
  } satisfies CuratedMemory;
}

export function makePolicy(overrides?: Partial<GovernancePolicy>): GovernancePolicy {
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

export function makeAuditEvent(overrides?: Partial<AuditEvent>): AuditEvent {
  return {
    id: randomUUID(),
    action: 'promoted',
    memoryId: randomUUID(),
    tenantId: 'team-alpha',
    actor: { type: 'human', id: 'user-1', name: 'Test User' },
    reason: 'Passed all governance rules',
    details: {},
    timestamp: NOW,
    ...overrides,
  };
}
