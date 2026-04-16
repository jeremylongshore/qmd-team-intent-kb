import { randomUUID } from 'node:crypto';
import {
  CuratedMemory as CuratedMemorySchema,
  AuditEvent as AuditEventSchema,
} from '@qmd-team-intent-kb/schema';
import type { MemoryCandidate, CuratedMemory, PolicyEvaluation } from '@qmd-team-intent-kb/schema';
import type { MemoryRepository, AuditRepository, MemoryLinksRepository } from '@qmd-team-intent-kb/store';
import type { PipelineResult } from '@qmd-team-intent-kb/policy-engine';
import type { SupersessionMatch } from '../supersession/supersession-detector.js';

/** Input bundle for a single promotion operation */
export interface PromotionInput {
  candidate: MemoryCandidate;
  contentHash: string;
  pipelineResult: PipelineResult;
  supersession?: SupersessionMatch;
}

/**
 * Promotes a candidate to a CuratedMemory and persists everything to the store.
 *
 * Steps:
 *   1. Convert pipeline evaluations to PolicyEvaluation records
 *   2. Build and validate the CuratedMemory via Zod schema
 *   3. If supersession: update old memory lifecycle to 'superseded' with link,
 *      then emit a 'superseded' audit event for the old memory
 *   4. Insert the new curated memory
 *   5. Emit a 'promoted' audit event for the new memory
 *
 * When dryRun=true all logic runs (including schema validation) but nothing is
 * written to the database.
 *
 * @returns The fully-formed CuratedMemory (always, even in dry-run mode).
 */
export function promote(
  input: PromotionInput,
  memoryRepo: MemoryRepository,
  auditRepo: AuditRepository,
  dryRun: boolean = false,
  linksRepo?: MemoryLinksRepository,
): CuratedMemory {
  const now = new Date().toISOString();
  const memoryId = randomUUID();

  // The pipeline does not carry a per-evaluation policyId, so one is generated per record.
  const policyEvaluations: PolicyEvaluation[] = input.pipelineResult.evaluations.map((ev) => ({
    policyId: randomUUID(),
    ruleId: ev.ruleId,
    result: ev.outcome,
    reason: ev.reason,
    evaluatedAt: now,
  }));

  const memory = CuratedMemorySchema.parse({
    id: memoryId,
    candidateId: input.candidate.id,
    source: input.candidate.source,
    content: input.candidate.content,
    title: input.candidate.title,
    category: input.candidate.category,
    trustLevel: input.candidate.trustLevel,
    sensitivity: 'internal',
    author: input.candidate.author,
    tenantId: input.candidate.tenantId,
    metadata: input.candidate.metadata,
    lifecycle: 'active',
    contentHash: input.contentHash,
    policyEvaluations,
    promotedAt: now,
    promotedBy: { type: 'system', id: 'curator' },
    updatedAt: now,
    version: 1,
  });

  if (!dryRun) {
    if (input.supersession !== undefined) {
      const oldMemory = memoryRepo.findById(input.supersession.supersededMemoryId);
      if (oldMemory !== null) {
        const updatedOld = CuratedMemorySchema.parse({
          ...oldMemory,
          lifecycle: 'superseded',
          supersession: {
            supersededBy: memoryId,
            reason: `Title similarity: ${input.supersession.similarity.toFixed(2)}`,
            linkedAt: now,
          },
          updatedAt: now,
        });
        memoryRepo.update(updatedOld);
      }

      auditRepo.insert(
        AuditEventSchema.parse({
          id: randomUUID(),
          action: 'superseded',
          memoryId: input.supersession.supersededMemoryId,
          tenantId: input.candidate.tenantId,
          actor: { type: 'system', id: 'curator' },
          reason: `Superseded by ${memoryId}`,
          details: {
            newMemoryId: memoryId,
            similarity: input.supersession.similarity,
          },
          timestamp: now,
        }),
      );

    }

    memoryRepo.insert(memory);

    if (input.supersession !== undefined && linksRepo) {
      linksRepo.insert({
        id: randomUUID(),
        sourceMemoryId: memoryId,
        targetMemoryId: input.supersession.supersededMemoryId,
        linkType: 'supersedes',
        weight: input.supersession.similarity,
        createdBy: 'curator',
        source: 'curator',
        importBatchId: null,
        createdAt: now,
      });
    }

    auditRepo.insert(
      AuditEventSchema.parse({
        id: randomUUID(),
        action: 'promoted',
        memoryId,
        tenantId: input.candidate.tenantId,
        actor: { type: 'system', id: 'curator' },
        reason: 'Passed all governance rules',
        details: { candidateId: input.candidate.id },
        timestamp: now,
      }),
    );
  }

  return memory;
}
