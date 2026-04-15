import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { ingestFromSpool, Curator } from '@qmd-team-intent-kb/curator';
import { runExport } from '@qmd-team-intent-kb/git-exporter';
import type { MemoryCandidate } from '@qmd-team-intent-kb/schema';
import { resolveRepoContext } from '@qmd-team-intent-kb/repo-resolver';
import type { DaemonConfig, DaemonDependencies, CycleResult, DaemonLogger } from './types.js';
import { runStalenessSweep } from './staleness.js';
import { writeFeedback } from './feedback.js';
import { filterByRepoScope } from './repo-scope.js';
import { withRetry } from './retry.js';

/**
 * Check if enterprise managed settings disable memory capture.
 *
 * Reads ~/.claude/settings.json and checks for memoryCapture.enabled === false.
 * Safe default: if file is absent or unparseable, returns true (proceed).
 */
function isMemoryCaptureEnabled(): boolean {
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
    staleness: null,
    export: null,
    indexUpdate: null,
  };

  // Threat #8: Enterprise managed settings check
  if (!isMemoryCaptureEnabled()) {
    logger.info('Memory capture disabled by enterprise settings — skipping cycle');
    result.completedAt = nowFn();
    return result;
  }

  // Resolve repo context for scopeByRepo filtering.
  //
  // Preference order:
  //   1. deps.repoContext is a RepoContext — use it directly (resolved once at startup).
  //   2. deps.repoContext is null         — startup resolution failed; scoping disabled.
  //   3. deps.repoContext is undefined    — not provided (e.g. test paths); fall back to
  //                                         resolving here per-cycle (legacy behaviour).
  //
  // On any resolver error, degrade gracefully: log a warning and disable scoping.
  let resolvedRemoteUrl: string | null = null;
  if (config.scopeByRepo) {
    if (deps.repoContext === null) {
      // Startup resolution failed — scoping was already warned at daemon start
      logger.warn(
        '[repo-scope] Startup resolver failed — repo-scope filter disabled for this cycle',
      );
    } else if (deps.repoContext !== undefined) {
      // Happy path: pre-resolved at startup, no subprocess cost this cycle
      resolvedRemoteUrl = deps.repoContext.remoteUrl;
      if (!resolvedRemoteUrl) {
        logger.warn(
          '[repo-scope] Resolver returned no remoteUrl — repo-scope filter disabled for this cycle',
        );
      }
    } else {
      // Fallback: deps.repoContext not provided — resolve now (backward-compat for tests)
      try {
        const repoResult = await resolveRepoContext(process.cwd());
        if (repoResult.ok) {
          resolvedRemoteUrl = repoResult.value.remoteUrl;
          if (!resolvedRemoteUrl) {
            logger.warn(
              '[repo-scope] Resolver returned no remoteUrl — repo-scope filter disabled for this cycle',
            );
          }
        } else {
          logger.warn(
            `[repo-scope] Resolver failed (${repoResult.error.kind}) — repo-scope filter disabled for this cycle`,
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.warn(
          `[repo-scope] Resolver threw unexpectedly: ${msg} — repo-scope filter disabled for this cycle`,
        );
      }
    }
  }

  // Step 1: Ingest from spool
  let ingestedCandidates: MemoryCandidate[] = [];
  try {
    const ingestResult = await ingestFromSpool(deps.candidateRepo, config.spoolDir);
    if (ingestResult.ok) {
      // Threat #2: Cap candidates per cycle
      const capped = ingestResult.value.slice(0, config.maxCandidatesPerCycle);
      if (ingestResult.value.length > config.maxCandidatesPerCycle) {
        const msg = `Capped ingestion: ${ingestResult.value.length} found, processing ${config.maxCandidatesPerCycle}`;
        result.ingest.errors.push(msg);
        logger.warn(msg);
      }

      // Apply repo-scope filter when flag is on and resolver succeeded with a remoteUrl
      if (config.scopeByRepo && resolvedRemoteUrl) {
        const scopeResult = filterByRepoScope(capped, resolvedRemoteUrl, logger);
        ingestedCandidates = scopeResult.kept;
        if (scopeResult.skipped > 0) {
          logger.warn(
            `[repo-scope] Skipped ${scopeResult.skipped} candidate(s) from mismatched repos`,
          );
        }
      } else {
        ingestedCandidates = capped;
      }

      result.ingest.ingested = ingestedCandidates.length;
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

      // Write rejection feedback for MCP status visibility
      if (result.curation.rejected > 0 || result.curation.flagged > 0) {
        try {
          writeFeedback(result.curation, nowFn);
        } catch (feedbackErr) {
          const msg = feedbackErr instanceof Error ? feedbackErr.message : String(feedbackErr);
          logger.warn(`Feedback write failed: ${msg}`);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`Curation error: ${msg}`);
    }
  }

  // Step 2b: Staleness sweep — auto-deprecate stale active memories
  if (config.enableStalenessSweep) {
    try {
      result.staleness = runStalenessSweep(
        deps.memoryRepo,
        deps.auditRepo,
        { tenantId: config.tenantId, staleDays: config.staleDays },
        nowFn,
      );
      if (result.staleness.deprecated > 0) {
        logger.info(
          `Staleness sweep: ${result.staleness.deprecated} of ${result.staleness.scanned} deprecated`,
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`Staleness sweep error: ${msg}`);
    }
  }

  // Step 3: Git export — retried on transient push conflicts
  if (config.enableExport) {
    try {
      result.export = await withRetry(
        async () =>
          runExport(
            deps.memoryRepo,
            deps.exportStateRepo,
            {
              outputDir: config.exportOutputDir,
              targetId: config.exportTargetId,
              tenantId: config.tenantId,
            },
            nowFn,
          ),
        {
          maxRetries: config.maxRetries,
          baseDelayMs: config.retryBaseDelayMs,
          maxJitterMs: config.retryMaxJitterMs,
          sleepFn: config.sleepFn,
        },
      );
      logger.info(
        `Export: ${result.export.written.length} written, ${result.export.archived.length} archived`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`Export error: ${msg}`);
    }
  }

  // Step 4: qmd index update — offline resilient, retried on transient qmd errors
  if (config.enableIndexUpdate && deps.qmdAdapter) {
    const retryOpts = {
      maxRetries: config.maxRetries,
      baseDelayMs: config.retryBaseDelayMs,
      maxJitterMs: config.retryMaxJitterMs,
      sleepFn: config.sleepFn,
    };
    try {
      await withRetry(async () => {
        const ensureResult = await deps.qmdAdapter!.ensureCollections();
        if (!ensureResult.ok) {
          const e = new Error(ensureResult.error.message);
          throw e;
        }
        const updateResult = await deps.qmdAdapter!.update();
        if (!updateResult.ok) {
          throw new Error(updateResult.error.message);
        }
      }, retryOpts);
      result.indexUpdate = { ok: true };
      logger.info('Index update complete');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      result.indexUpdate = { ok: false, error: msg };
      logger.warn(`Index update error: ${msg}`);
    }
  }

  result.completedAt = nowFn();
  return result;
}
