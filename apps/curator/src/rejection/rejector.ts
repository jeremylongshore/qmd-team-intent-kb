import { randomUUID } from 'node:crypto';
import { AuditEvent as AuditEventSchema } from '@qmd-team-intent-kb/schema';
import type { MemoryCandidate } from '@qmd-team-intent-kb/schema';
import type { AuditRepository } from '@qmd-team-intent-kb/store';
import type { PipelineResult } from '@qmd-team-intent-kb/policy-engine';

/**
 * Records a candidate rejection in the audit log and returns the human-readable
 * rejection reason.
 *
 * The audit event uses the 'deleted' action because no curated memory was
 * created — the candidate was turned away at the governance gate.
 *
 * When dryRun=true the audit event is not persisted.
 *
 * @returns A human-readable string describing why the candidate was rejected or flagged.
 */
export function reject(
  candidate: MemoryCandidate,
  pipelineResult: PipelineResult,
  auditRepo: AuditRepository,
  dryRun: boolean = false,
): string {
  const reason =
    pipelineResult.rejectedBy !== undefined
      ? `Rejected by rule: ${pipelineResult.rejectedBy}`
      : `Flagged by rules: ${pipelineResult.flaggedBy?.join(', ') ?? 'unknown'}`;

  if (!dryRun) {
    auditRepo.insert(
      AuditEventSchema.parse({
        id: randomUUID(),
        action: 'deleted',
        memoryId: candidate.id,
        tenantId: candidate.tenantId,
        actor: { type: 'system', id: 'curator' },
        reason,
        details: {
          candidateId: candidate.id,
          outcome: pipelineResult.outcome,
          evaluations: pipelineResult.evaluations,
        },
        timestamp: new Date().toISOString(),
      }),
    );
  }

  return reason;
}
