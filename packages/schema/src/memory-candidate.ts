import { z } from 'zod';
import { CandidateStatus, MemoryCategory, MemorySource, TrustLevel } from './enums.js';
import { Author, ContentMetadata, IsoDatetime, NonEmptyString, TenantId, Uuid } from './common.js';

/** Pre-policy flags raised during capture */
export const PrePolicyFlags = z.object({
  potentialSecret: z.boolean().default(false),
  lowConfidence: z.boolean().default(false),
  duplicateSuspect: z.boolean().default(false),
});
export type PrePolicyFlags = z.infer<typeof PrePolicyFlags>;

/** A raw memory proposal captured from a Claude Code session, before governance */
export const MemoryCandidate = z.object({
  id: Uuid,
  status: CandidateStatus,
  source: MemorySource,
  content: NonEmptyString,
  title: NonEmptyString,
  category: MemoryCategory,
  trustLevel: TrustLevel.default('medium'),
  author: Author,
  tenantId: TenantId,
  metadata: ContentMetadata.default({ filePaths: [], tags: [] }),
  prePolicyFlags: PrePolicyFlags.default({
    potentialSecret: false,
    lowConfidence: false,
    duplicateSuspect: false,
  }),
  capturedAt: IsoDatetime,
});
export type MemoryCandidate = z.infer<typeof MemoryCandidate>;
