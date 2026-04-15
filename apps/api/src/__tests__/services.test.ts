import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  createTestDatabase,
  CandidateRepository,
  MemoryRepository,
  PolicyRepository,
  AuditRepository,
} from '@qmd-team-intent-kb/store';
import { CandidateService } from '../services/candidate-service.js';
import { MemoryService } from '../services/memory-service.js';
import { PolicyService } from '../services/policy-service.js';
import { HealthService } from '../services/health-service.js';
import { ApiError } from '../errors.js';
import { makeCandidate, makeMemory, makePolicy, NOW } from './fixtures.js';

describe('CandidateService', () => {
  let db: Database.Database;
  let repo: CandidateRepository;
  let service: CandidateService;

  beforeEach(() => {
    db = createTestDatabase();
    repo = new CandidateRepository(db);
    service = new CandidateService(repo);
  });

  it('intake validates and inserts a candidate', () => {
    const data = makeCandidate();
    const candidate = service.intake(data);
    expect(candidate.id).toBe(data['id']);
    expect(candidate.status).toBe('inbox');
    // Verify persistence
    const fromRepo = repo.findById(candidate.id);
    expect(fromRepo).not.toBeNull();
  });

  it('intake rejects invalid data with a 400 ApiError', () => {
    expect(() => service.intake({ title: 'No required fields' })).toThrow(ApiError);
    expect(() => service.intake({ title: 'No required fields' })).toThrow(/Invalid candidate/);
  });

  it('getById throws 404 ApiError for unknown id', () => {
    expect(() => service.getById('00000000-0000-0000-0000-000000000000')).toThrow(ApiError);
    try {
      service.getById('00000000-0000-0000-0000-000000000000');
    } catch (err) {
      expect(err instanceof ApiError).toBe(true);
      if (err instanceof ApiError) {
        expect(err.statusCode).toBe(404);
      }
    }
  });
});

describe('MemoryService', () => {
  let db: Database.Database;
  let memoryRepo: MemoryRepository;
  let auditRepo: AuditRepository;
  let service: MemoryService;

  beforeEach(() => {
    db = createTestDatabase();
    memoryRepo = new MemoryRepository(db);
    auditRepo = new AuditRepository(db);
    service = new MemoryService(memoryRepo, auditRepo);
  });

  it('transition validates allowed lifecycle transitions', () => {
    const memory = makeMemory({ lifecycle: 'active' });
    memoryRepo.insert(memory);

    const result = service.transition(memory.id, 'deprecated', {
      reason: 'No longer maintained',
      actor: { type: 'human', id: 'user-1', name: 'Test User' },
    });
    expect(result.lifecycle).toBe('deprecated');
  });

  it('transition rejects disallowed lifecycle transitions with 400', () => {
    const memory = makeMemory({ lifecycle: 'archived' });
    memoryRepo.insert(memory);

    expect(() =>
      service.transition(memory.id, 'active', {
        reason: 'Attempt to reactivate',
        actor: { type: 'human', id: 'user-1' },
      }),
    ).toThrow(ApiError);
  });

  it('transition creates a corresponding audit trail entry', () => {
    const memory = makeMemory({ lifecycle: 'active', tenantId: 'team-audit' });
    memoryRepo.insert(memory);

    service.transition(memory.id, 'archived', {
      reason: 'Archiving',
      actor: { type: 'human', id: 'user-1', name: 'Test User' },
    });

    const events = auditRepo.findByMemory(memory.id);
    expect(events.length).toBe(1);
    expect(events[0]?.action).toBe('archived');
    expect(events[0]?.tenantId).toBe('team-audit');
  });
});

describe('PolicyService', () => {
  let db: Database.Database;
  let repo: PolicyRepository;
  let service: PolicyService;

  beforeEach(() => {
    db = createTestDatabase();
    repo = new PolicyRepository(db);
    service = new PolicyService(repo);
  });

  it('create validates data with Zod and inserts', () => {
    const data = makePolicy();
    const policy = service.create(data);
    expect(policy.id).toBe(data['id']);
    expect(repo.findById(policy.id)).not.toBeNull();
  });

  it('create rejects invalid data with a 400 ApiError', () => {
    expect(() => service.create({ name: 'Missing everything' })).toThrow(ApiError);
    try {
      service.create({ name: 'Missing everything' });
    } catch (err) {
      if (err instanceof ApiError) {
        expect(err.statusCode).toBe(400);
      }
    }
  });
});

describe('HealthService', () => {
  let db: Database.Database;
  let service: HealthService;

  beforeEach(() => {
    db = createTestDatabase();
    service = new HealthService(db);
  });

  it('check returns healthy status when database is connected', () => {
    const status = service.check();
    expect(status.status).toBe('healthy');
    expect(status.dbConnected).toBe(true);
  });

  it('check returns version string', () => {
    const status = service.check();
    expect(status.version).toBe('0.4.0');
  });

  it('check returns a non-negative uptime', () => {
    const status = service.check();
    expect(status.uptime).toBeGreaterThanOrEqual(0);
  });

  it('check returns degraded when database is closed', () => {
    db.close();
    const status = service.check();
    expect(status.status).toBe('degraded');
    expect(status.dbConnected).toBe(false);
  });
});

// Keep a reference to NOW to avoid unused import warning
const _now: string = NOW;
void _now;
