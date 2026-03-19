import type { AuditRepository } from '@qmd-team-intent-kb/store';
import type { CurationReport } from '../types.js';

/**
 * Aggregate curation outcomes from the audit trail.
 * Counts promoted, demoted (rejected), superseded, and archived events.
 */
export function aggregateCuration(auditRepo: AuditRepository): CurationReport {
  const actionCounts = auditRepo.countByAction();

  const promoted = actionCounts['promoted'] ?? 0;
  const rejected = actionCounts['demoted'] ?? 0;
  const superseded = actionCounts['superseded'] ?? 0;
  const archived = actionCounts['archived'] ?? 0;

  const denominator = promoted + rejected;
  const promotionRate = denominator > 0 ? promoted / denominator : 0;

  return { promoted, rejected, superseded, archived, promotionRate };
}
