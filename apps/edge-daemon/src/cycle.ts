import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { ingestFromSpool, Curator } from '@qmd-team-intent-kb/curator';
import { runExport } from '@qmd-team-intent-kb/git-exporter';
import type { MemoryCandidate } from '@qmd-team-intent-kb/schema';
import type { DaemonConfig, DaemonDependencies, CycleResult, DaemonLogger } from './types.js';

/**
 * Check if enterprise managed settings disable memory capture.
 *
 * Reads ~/.claude/settings.json and checks for memoryCapture.enabled === false.
 * Safe default: if file is absent or unparseable, returns true (proceed).
 */
export function isMemoryCaptureEnabled(): boolean {
  try {
    const settingsPath = join(homedir(), '.claude', 'settings.json');
    if (!existsSync(settingsPath)) return true;
    const raw = readFileSync(settingsPath, 'utf8');
    const settings = JSON.parse(raw) as Record<string, unknown>;
    const memoryCapture = settings['memoryCapture'] as Record<string, unknown> | undefined;
    if (memoryCapture && memoryCapture['enabled'] === false) return false;
    return true;
  } catch {
    return true; // safe default: proceed if settings unreadable
  }
}

/**
 * Run one full daemon cycle: ingest → curate → export → index update.
 *
 * Each step catches its own errors. A failed step does NOT abort the cycle —
 * it records the error and continues to the next step.
 */
export async function runCycle(
  config: DaemonConfig,
  deps: DaemonDependencies,
  logger: DaemonLogger,
): Promise<CycleResult> {
  const nowFn = config.nowFn ?? (() => new Date().toISOString());
  const startedAt = nowFn();

  const result: CycleResult = {
    startedAt,
    completedAt: '',
    ingest: { ingested: 0, errors: [] },
    curation: null,
    export: null,
    indexUpdate: null,
  };

  // Threat #8: Enterprise managed settings check
  if (!isMemoryCaptureEnabled()) {
    logger.info('Memory capture disabled by enterprise settings — skipping cycle');
    result.completedAt = nowFn();
    return result;
  }

  // Step 1: Ingest from spool
  let ingestedCandidates: MemoryCandidate[] = [];
  try {
    const ingestResult = await ingestFromSpool(deps.candidateRepo, config.spoolDir);
    if (ingestResult.ok) {
      // Threat #2: Cap candidates per cycle
      ingestedCandidates = ingestResult.value.slice(0, config.maxCandidatesPerCycle);
      result.ingest.ingested = ingestedCandidates.length;
      if (ingestResult.value.length > config.maxCandidatesPerCycle) {
        const msg = `Capped ingestion: ${ingestResult.value.length} found, processing ${config.maxCandidatesPerCycle}`;
        result.ingest.errors.push(msg);
        logger.warn(msg);
      }
    } else {
      result.ingest.errors.push(ingestResult.error);
      logger.error(`Ingest failed: ${ingestResult.error}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    result.ingest.errors.push(msg);
    logger.error(`Ingest error: ${msg}`);
  }

  // Step 2: Curate — only if we ingested something
  if (ingestedCandidates.length > 0) {
    try {
      const curator = new Curator(
        {
          candidateRepo: deps.candidateRepo,
          memoryRepo: deps.memoryRepo,
          policyRepo: deps.policyRepo,
          auditRepo: deps.auditRepo,
        },
        {
          tenantId: config.tenantId,
          supersessionThreshold: config.supersessionThreshold,
        },
      );

      result.curation = curator.processBatch(ingestedCandidates);
      logger.info(
        `Curation: ${result.curation.promoted} promoted, ${result.curation.rejected} rejected, ${result.curation.duplicates} duplicates`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`Curation error: ${msg}`);
    }
  }

  // Step 3: Git export
  if (config.enableExport) {
    try {
      result.export = runExport(
        deps.memoryRepo,
        deps.exportStateRepo,
        {
          outputDir: config.exportOutputDir,
          targetId: config.exportTargetId,
          tenantId: config.tenantId,
        },
        nowFn,
      );
      logger.info(
        `Export: ${result.export.written.length} written, ${result.export.archived.length} archived`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`Export error: ${msg}`);
    }
  }

  // Step 4: qmd index update — offline resilient
  if (config.enableIndexUpdate && deps.qmdAdapter) {
    try {
      const ensureResult = await deps.qmdAdapter.ensureCollections();
      if (!ensureResult.ok) {
        result.indexUpdate = { ok: false, error: ensureResult.error.message };
        logger.warn(`Index ensureCollections failed: ${ensureResult.error.message}`);
      } else {
        const updateResult = await deps.qmdAdapter.update();
        if (updateResult.ok) {
          result.indexUpdate = { ok: true };
          logger.info('Index update complete');
        } else {
          result.indexUpdate = { ok: false, error: updateResult.error.message };
          logger.warn(`Index update failed: ${updateResult.error.message}`);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      result.indexUpdate = { ok: false, error: msg };
      logger.warn(`Index update error: ${msg}`);
    }
  }

  result.completedAt = nowFn();
  return result;
}
