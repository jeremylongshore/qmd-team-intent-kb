import type Database from 'better-sqlite3';
import {
  createTestDatabase,
  MemoryRepository,
  AuditRepository,
  CandidateRepository,
} from '@qmd-team-intent-kb/store';

export {
  makeMemory,
  makeCandidateWithHash as makeCandidate,
  makeAuditEvent,
} from '@qmd-team-intent-kb/test-fixtures';

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
