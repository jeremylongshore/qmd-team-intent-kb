import { z } from 'zod';
import { AuditAction } from './enums.js';
import { Author, IsoDatetime, NonEmptyString, TenantId, Uuid } from './common.js';

/** An immutable audit trail event recording a memory operation */
export const AuditEvent = z.object({
  id: Uuid,
  action: AuditAction,
  memoryId: Uuid,
  tenantId: TenantId,
  actor: Author,
  reason: NonEmptyString.optional(),
  details: z.record(z.unknown()).default({}),
  timestamp: IsoDatetime,
});
export type AuditEvent = z.infer<typeof AuditEvent>;
