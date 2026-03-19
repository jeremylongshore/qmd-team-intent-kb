import { createDatabase } from '@qmd-team-intent-kb/store';
import {
  CandidateRepository,
  MemoryRepository,
  PolicyRepository,
  AuditRepository,
  ExportStateRepository,
} from '@qmd-team-intent-kb/store';
import { resolveTeamKbPath } from '@qmd-team-intent-kb/common';
import { QmdAdapter } from '@qmd-team-intent-kb/qmd-adapter';
import { loadDaemonConfig } from './config.js';
import { EdgeDaemon } from './daemon.js';
import { ConsoleDaemonLogger } from './health.js';

/**
 * CLI entry point for the edge daemon.
 *
 * Usage: DAEMON_TENANT_ID=my-team tsx src/main.ts
 */
async function main(): Promise<void> {
  const logger = new ConsoleDaemonLogger();

  let config;
  try {
    config = loadDaemonConfig();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`Configuration error: ${msg}`);
    process.exit(1);
  }

  // Open (or create) the canonical SQLite store
  const dbPath = resolveTeamKbPath('teamkb.db');
  const db = createDatabase({ path: dbPath });

  const deps = {
    candidateRepo: new CandidateRepository(db),
    memoryRepo: new MemoryRepository(db),
    policyRepo: new PolicyRepository(db),
    auditRepo: new AuditRepository(db),
    exportStateRepo: new ExportStateRepository(db),
    qmdAdapter: new QmdAdapter({ tenantId: config.tenantId }),
  };

  const daemon = new EdgeDaemon(config, deps, logger);

  try {
    daemon.start();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(msg);
    process.exit(1);
  }
}

void main();
