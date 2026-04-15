import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import {
  createTestDatabase,
  MemoryRepository,
  AuditRepository,
  CandidateRepository,
} from '@qmd-team-intent-kb/store';
import { computeContentHash } from '@qmd-team-intent-kb/common';
import type { CuratedMemory, MemoryCandidate, AuditEvent } from '@qmd-team-intent-kb/schema';

const NOW = '2026-01-15T10:00:00.000Z';

export function createTestRepos(): {
  db: Database.Database;
  memoryRepo: MemoryRepository;
  auditRepo: AuditRepository;
  candidateRepo: CandidateRepository;
} {
  const db = createTestDatabase();
  return {
    db,
    memoryRepo: new MemoryRepository(db),
    auditRepo: new AuditRepository(db),
    candidateRepo: new CandidateRepository(db),
  };
}

export function makeMemory(overrides?: Partial<CuratedMemory>): CuratedMemory {
  const content = overrides?.content ?? 'Test memory content ' + randomUUID();
  return {
    id: randomUUID(),
    candidateId: randomUUID(),
    source: 'claude_session',
    content,
    title: 'Test memory',
    category: 'pattern',
    trustLevel: 'high',
    sensitivity: 'internal',
    author: { type: 'ai', id: 'claude-1', name: 'Claude' },
    tenantId: 'team-alpha',
    metadata: { filePaths: [], tags: [] },
    lifecycle: 'active',
    contentHash: computeContentHash(content),
    policyEvaluations: [],
    promotedAt: NOW,
    promotedBy: { type: 'human', id: 'user-1', name: 'Test User' },
    updatedAt: NOW,
    version: 1,
    ...overrides,
  } satisfies CuratedMemory;
}

export function makeCandidate(overrides?: Partial<MemoryCandidate>): {
  candidate: MemoryCandidate;
  contentHash: string;
} {
  const content = overrides?.content ?? 'Test candidate content ' + randomUUID();
  const candidate: MemoryCandidate = {
    id: randomUUID(),
    status: 'inbox',
    source: 'claude_session',
    content,
    title: 'Test candidate',
    category: 'convention',
    trustLevel: 'medium',
    author: { type: 'ai', id: 'claude-1', name: 'Claude' },
    tenantId: 'team-alpha',
    metadata: { filePaths: [], tags: [] },
    prePolicyFlags: { potentialSecret: false, lowConfidence: false, duplicateSuspect: false },
    capturedAt: NOW,
    ...overrides,
  };
  return { candidate, contentHash: computeContentHash(content) };
}

export function makeAuditEvent(overrides?: Partial<AuditEvent>): AuditEvent {
  return {
    id: randomUUID(),
    action: 'promoted',
    memoryId: randomUUID(),
    tenantId: 'team-alpha',
    actor: { type: 'human', id: 'user-1', name: 'Test User' },
    reason: 'Test reason',
    details: {},
    timestamp: NOW,
    ...overrides,
  };
}
