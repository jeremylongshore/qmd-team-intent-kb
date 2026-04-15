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
import { ConsoleDaemonLogger } from './health.js';
import { dispatch } from './cli.js';

/**
 * CLI entry point for the edge daemon.
 *
 * Usage: DAEMON_TENANT_ID=my-team tsx src/main.ts [start|stop|status|run-once]
 *
 * Default subcommand is `start` when none is provided.
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

  const dbPath = resolveTeamKbPath('teamkb.db');
  const db = createDatabase({ path: dbPath });

  const daemonDeps = {
    candidateRepo: new CandidateRepository(db),
    memoryRepo: new MemoryRepository(db),
    policyRepo: new PolicyRepository(db),
    auditRepo: new AuditRepository(db),
    exportStateRepo: new ExportStateRepository(db),
    qmdAdapter: new QmdAdapter({ tenantId: config.tenantId }),
  };

  const exitCode = await dispatch(process.argv.slice(2), { config, daemonDeps, logger });
  process.exit(exitCode);
}

void main();
