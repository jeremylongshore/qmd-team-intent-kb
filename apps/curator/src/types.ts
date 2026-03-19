import type { PipelineResult } from '@qmd-team-intent-kb/policy-engine';

/** Result of curating a single candidate */
export interface CurationResult {
  candidateId: string;
  outcome: 'promoted' | 'rejected' | 'flagged' | 'duplicate';
  /** Set when the candidate was promoted to a curated memory */
  memoryId?: string;
  /** memoryId of the curated memory that was superseded by this promotion */
  supersedes?: string;
  pipelineResult?: PipelineResult;
  reason: string;
}

/** Aggregate result of a batch curation run */
export interface CurationBatchResult {
  processed: number;
  promoted: number;
  rejected: number;
  flagged: number;
  duplicates: number;
  results: CurationResult[];
}

/** Configuration for a Curator instance */
export interface CuratorConfig {
  tenantId: string;
  /** When true, all pipeline logic runs but nothing is persisted to the database */
  dryRun?: boolean;
  /**
   * Jaccard similarity threshold for title-based supersession detection.
   * Range 0.0–1.0. Default 0.6.
   */
  supersessionThreshold?: number;
}
