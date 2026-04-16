import { z } from 'zod';
import { PolicyRuleAction, PolicyRuleType } from './enums.js';
import { IsoDatetime, NonEmptyString, TenantId, Uuid } from './common.js';

/** A single governance rule within a policy */
export const PolicyRule = z.object({
  id: NonEmptyString,
  type: PolicyRuleType,
  action: PolicyRuleAction,
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).default(0),
  parameters: z.record(z.string(), z.unknown()).default({}),
  description: z.string().optional(),
});
export type PolicyRule = z.infer<typeof PolicyRule>;

/** A governance policy containing ordered rules */
export const GovernancePolicy = z.object({
  id: Uuid,
  name: NonEmptyString,
  tenantId: TenantId,
  rules: z.array(PolicyRule).min(1),
  enabled: z.boolean().default(true),
  version: z.number().int().positive().default(1),
  createdAt: IsoDatetime,
  updatedAt: IsoDatetime,
});
export type GovernancePolicy = z.infer<typeof GovernancePolicy>;
