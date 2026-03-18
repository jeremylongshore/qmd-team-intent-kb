import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import {
  CandidateRepository,
  MemoryRepository,
  PolicyRepository,
  AuditRepository,
} from '@qmd-team-intent-kb/store';
import { CandidateService } from './services/candidate-service.js';
import { MemoryService } from './services/memory-service.js';
import { PolicyService } from './services/policy-service.js';
import { HealthService } from './services/health-service.js';
import { registerCandidateRoutes } from './routes/candidates.js';
import { registerMemoryRoutes } from './routes/memories.js';
import { registerPolicyRoutes } from './routes/policies.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerAuditRoutes } from './routes/audit.js';

/** External dependencies injected into the application factory. */
export interface AppDependencies {
  /** An open better-sqlite3 database connection (real or in-memory). */
  db: Database.Database;
  /** Suppress Fastify's built-in logger — useful in tests. Default: false. */
  silent?: boolean;
}

/**
 * Build and configure the Fastify application.
 *
 * Repositories and services are constructed here and wired into route
 * handlers. No `.listen()` is called — callers are responsible for
 * starting the server or using `inject()` for testing.
 */
export function buildApp(deps: AppDependencies): FastifyInstance {
  const app = Fastify({ logger: deps.silent !== false ? false : true });

  // Repositories
  const candidateRepo = new CandidateRepository(deps.db);
  const memoryRepo = new MemoryRepository(deps.db);
  const policyRepo = new PolicyRepository(deps.db);
  const auditRepo = new AuditRepository(deps.db);

  // Services
  const candidateService = new CandidateService(candidateRepo);
  const memoryService = new MemoryService(memoryRepo, auditRepo);
  const policyService = new PolicyService(policyRepo);
  const healthService = new HealthService(deps.db);

  // Routes
  registerHealthRoutes(app, healthService);
  registerCandidateRoutes(app, candidateService);
  registerMemoryRoutes(app, memoryService);
  registerPolicyRoutes(app, policyService);
  registerAuditRoutes(app, auditRepo);

  return app;
}
