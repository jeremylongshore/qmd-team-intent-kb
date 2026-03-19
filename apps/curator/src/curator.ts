import { computeContentHash } from '@qmd-team-intent-kb/common';
import { PolicyPipeline } from '@qmd-team-intent-kb/policy-engine';
import type { PipelineResult } from '@qmd-team-intent-kb/policy-engine';
import type { MemoryCandidate } from '@qmd-team-intent-kb/schema';
import type {
  CandidateRepository,
  MemoryRepository,
  PolicyRepository,
  AuditRepository,
} from '@qmd-team-intent-kb/store';
import type { CuratorConfig, CurationResult, CurationBatchResult } from './types.js';
import { checkDuplicate } from './dedup/dedup-checker.js';
import { detectSupersession } from './supersession/supersession-detector.js';
import { promote } from './promotion/promoter.js';
import { reject } from './rejection/rejector.js';

/** Repository dependencies required by the Curator */
export interface CuratorDependencies {
  candidateRepo: CandidateRepository;
  memoryRepo: MemoryRepository;
  policyRepo: PolicyRepository;
  auditRepo: AuditRepository;
}

/**
 * Orchestrates the full curation pipeline for memory candidates.
 *
 * Pipeline steps (per candidate):
 *   1. Compute SHA-256 content hash
 *   2. Exact-hash duplicate check against curated memories
 *   3. Load the first enabled governance policy for the tenant
 *   4. Run policy pipeline (secret detection, length, trust, relevance, dedup, tenant match)
 *   5. On rejection/flagging: record audit and return outcome
 *   6. On approval: detect title-similarity supersession, then promote
 *
 * All operations are synchronous. Only `ingestFromSpool` (file I/O) is async.
 */
export class Curator {
  constructor(
    private readonly deps: CuratorDependencies,
    private readonly config: CuratorConfig,
  ) {}

  /**
   * Process a single candidate through the full governance pipeline.
   *
   * @returns A CurationResult describing the outcome.
   */
  processSingle(candidate: MemoryCandidate): CurationResult {
    // Step 1: Compute content hash
    const contentHash = computeContentHash(candidate.content);

    // Step 2: Exact-hash duplicate check
    const dedup = checkDuplicate(candidate, this.deps.memoryRepo);
    if (dedup.isDuplicate) {
      return {
        candidateId: candidate.id,
        outcome: 'duplicate',
        reason: `Exact duplicate of memory ${dedup.matchedMemoryId}`,
      };
    }

    // Step 3: Load governance policy (first enabled policy for tenant)
    const policies = this.deps.policyRepo.findByTenant(this.config.tenantId);
    const policy = policies.find((p) => p.enabled);

    if (policy === undefined) {
      // No enabled policy = auto-approve without evaluation
      return this.promoteCandidate(candidate, contentHash, {
        candidateId: candidate.id,
        outcome: 'approved',
        evaluations: [],
      });
    }

    // Step 4: Run policy pipeline
    const pipeline = new PolicyPipeline(policy);
    const existingHashes = new Set(this.deps.memoryRepo.getAllContentHashes());
    const pipelineResult = pipeline.evaluate(candidate, {
      existingHashes,
      tenantId: this.config.tenantId,
    });

    // Step 5: Rejected — record audit, return rejected outcome
    if (pipelineResult.outcome === 'rejected') {
      const reason = reject(candidate, pipelineResult, this.deps.auditRepo, this.config.dryRun);
      return {
        candidateId: candidate.id,
        outcome: 'rejected',
        pipelineResult,
        reason,
      };
    }

    // Step 5b: Flagged — record audit, return flagged outcome (not promoted)
    if (pipelineResult.outcome === 'flagged') {
      const reason = reject(candidate, pipelineResult, this.deps.auditRepo, this.config.dryRun);
      return {
        candidateId: candidate.id,
        outcome: 'flagged',
        pipelineResult,
        reason,
      };
    }

    // Step 6: Approved — detect supersession then promote
    return this.promoteCandidate(candidate, contentHash, pipelineResult);
  }

  /**
   * Process a batch of candidates through the pipeline.
   *
   * Candidates are processed in order; each is independent of the others.
   */
  processBatch(candidates: MemoryCandidate[]): CurationBatchResult {
    const results: CurationResult[] = [];
    let promoted = 0;
    let rejected = 0;
    let flagged = 0;
    let duplicates = 0;

    for (const candidate of candidates) {
      const result = this.processSingle(candidate);
      results.push(result);

      switch (result.outcome) {
        case 'promoted':
          promoted++;
          break;
        case 'rejected':
          rejected++;
          break;
        case 'flagged':
          flagged++;
          break;
        case 'duplicate':
          duplicates++;
          break;
      }
    }

    return {
      processed: candidates.length,
      promoted,
      rejected,
      flagged,
      duplicates,
      results,
    };
  }

  private promoteCandidate(
    candidate: MemoryCandidate,
    contentHash: string,
    pipelineResult: PipelineResult,
  ): CurationResult {
    const supersession = detectSupersession(
      candidate,
      this.deps.memoryRepo,
      this.config.supersessionThreshold ?? 0.6,
    );

    const memory = promote(
      {
        candidate,
        contentHash,
        pipelineResult,
        supersession: supersession ?? undefined,
      },
      this.deps.memoryRepo,
      this.deps.auditRepo,
      this.config.dryRun,
    );

    return {
      candidateId: candidate.id,
      outcome: 'promoted',
      memoryId: memory.id,
      supersedes: supersession?.supersededMemoryId,
      pipelineResult,
      reason:
        supersession !== null
          ? `Promoted (supersedes ${supersession.supersededMemoryId})`
          : 'Promoted',
    };
  }
}
