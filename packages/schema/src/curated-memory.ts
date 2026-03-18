import { z } from 'zod';
import {
  MemoryCategory,
  MemoryLifecycleState,
  MemorySource,
  Sensitivity,
  TrustLevel,
} from './enums.js';
import {
  Author,
  ContentMetadata,
  IsoDatetime,
  NonEmptyString,
  Sha256Hash,
  TenantId,
  Uuid,
} from './common.js';

/** Record of a policy evaluation result for this memory */
export const PolicyEvaluation = z.object({
  policyId: Uuid,
  ruleId: NonEmptyString,
  result: z.enum(['pass', 'fail', 'flag']),
  reason: z.string().optional(),
  evaluatedAt: IsoDatetime,
});
export type PolicyEvaluation = z.infer<typeof PolicyEvaluation>;

/** Supersession link — points to the memory that replaced this one */
export const SupersessionLink = z.object({
  supersededBy: Uuid,
  reason: NonEmptyString,
  linkedAt: IsoDatetime,
});
export type SupersessionLink = z.infer<typeof SupersessionLink>;

/** A memory that has passed governance and entered the curated lifecycle */
export const CuratedMemory = z
  .object({
    id: Uuid,
    candidateId: Uuid,
    source: MemorySource,
    content: NonEmptyString,
    title: NonEmptyString,
    category: MemoryCategory,
    trustLevel: TrustLevel,
    sensitivity: Sensitivity.default('internal'),
    author: Author,
    tenantId: TenantId,
    metadata: ContentMetadata.default({}),
    lifecycle: MemoryLifecycleState,
    contentHash: Sha256Hash,
    policyEvaluations: z.array(PolicyEvaluation).default([]),
    supersession: SupersessionLink.optional(),
    promotedAt: IsoDatetime,
    promotedBy: Author,
    updatedAt: IsoDatetime,
    version: z.number().int().positive().default(1),
  })
  .refine(
    (data) => {
      if (data.lifecycle === 'superseded') {
        return data.supersession !== undefined;
      }
      return true;
    },
    {
      message: 'supersession must be defined when lifecycle is "superseded"',
      path: ['supersession'],
    },
  );

export type CuratedMemory = z.infer<typeof CuratedMemory>;

/** Narrowed type: an active curated memory */
export type ActiveMemory = CuratedMemory & { lifecycle: 'active' };

/** Narrowed type: a superseded curated memory with required supersession link */
export type SupersededMemory = CuratedMemory & {
  lifecycle: 'superseded';
  supersession: z.infer<typeof SupersessionLink>;
};
