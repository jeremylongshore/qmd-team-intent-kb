import { randomUUID } from 'node:crypto';
import { AuditEvent } from '@qmd-team-intent-kb/schema';
import type { MemoryRepository, AuditRepository } from '@qmd-team-intent-kb/store';
import type { StalenessSweepResult } from './types.js';

/**
 * Sweep active memories and auto-deprecate those not updated within staleDays.
 * Produces audit events for each transition.
 */
export function runStalenessSweep(
  memoryRepo: MemoryRepository,
  auditRepo: AuditRepository,
  config: { tenantId: string; staleDays: number },
  nowFn: () => string,
): StalenessSweepResult {
  const now = nowFn();
  const thresholdMs = new Date(now).getTime() - config.staleDays * 24 * 60 * 60 * 1000;
  const threshold = new Date(thresholdMs).toISOString();

  const staleMemories = memoryRepo.findStale(threshold);
  // Filter to configured tenant
  const tenantStale = staleMemories.filter((m) => m.tenantId === config.tenantId);

  const result: StalenessSweepResult = {
    scanned: tenantStale.length,
    deprecated: 0,
    errors: [],
  };

  for (const memory of tenantStale) {
    try {
      memoryRepo.updateLifecycle(memory.id, 'deprecated', now);

      const auditEvent = AuditEvent.parse({
        id: randomUUID(),
        action: 'demoted',
        memoryId: memory.id,
        tenantId: memory.tenantId,
        actor: { type: 'system', id: 'staleness-daemon' },
        reason: `Auto-deprecated: no updates for ${config.staleDays} days`,
        details: { from: 'active', to: 'deprecated', staleDays: config.staleDays },
        timestamp: now,
      });
      auditRepo.insert(auditEvent);

      result.deprecated++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      result.errors.push(`Failed to deprecate ${memory.id}: ${msg}`);
    }
  }

  return result;
}
