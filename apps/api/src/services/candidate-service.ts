import type { CandidateRepository } from '@qmd-team-intent-kb/store';
import { MemoryCandidate } from '@qmd-team-intent-kb/schema';
import { computeContentHash } from '@qmd-team-intent-kb/common';
import { badRequest, notFound } from '../errors.js';

/**
 * Service layer for memory candidate intake and retrieval.
 * Validates all inputs with Zod before writing to the repository.
 */
export class CandidateService {
  constructor(private readonly repo: CandidateRepository) {}

  /**
   * Validate and intake a new memory candidate.
   * Computes the content hash and inserts the record.
   * Throws a 400 ApiError on invalid input.
   */
  intake(data: unknown): MemoryCandidate {
    const parsed = MemoryCandidate.safeParse(data);
    if (!parsed.success) {
      throw badRequest(`Invalid candidate: ${parsed.error.message}`);
    }
    const candidate = parsed.data;
    const contentHash = computeContentHash(candidate.content);
    this.repo.insert(candidate, contentHash);
    return candidate;
  }

  /**
   * Retrieve a candidate by its UUID.
   * Throws a 404 ApiError if not found.
   */
  getById(id: string): MemoryCandidate {
    const candidate = this.repo.findById(id);
    if (candidate === null) throw notFound(`Candidate ${id} not found`);
    return candidate;
  }

  /**
   * List candidates, optionally filtered by tenant.
   * When no tenantId is provided, a 400 ApiError is thrown — the API
   * always requires a tenant scope for list operations.
   */
  list(tenantId: string | undefined): MemoryCandidate[] {
    if (tenantId !== undefined && tenantId.length > 0) {
      return this.repo.findByTenant(tenantId);
    }
    throw badRequest('tenantId query parameter is required');
  }

  /**
   * Internal helper — check whether a content hash is already stored.
   * Returns null when no match exists.
   */
  findByHash(hash: string): MemoryCandidate | null {
    return this.repo.findByContentHash(hash);
  }
}
