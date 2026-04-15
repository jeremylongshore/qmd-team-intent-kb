import { randomUUID } from 'node:crypto';
import type { AuditEvent } from '@qmd-team-intent-kb/schema';
import { FIXED_NOW, DEFAULT_TENANT } from './constants.js';

/**
 * Build a valid {@link AuditEvent} with sensible defaults.
 * Pass `overrides` to vary specific fields.
 */
export function makeAuditEvent(overrides?: Partial<AuditEvent>): AuditEvent {
  return {
    id: randomUUID(),
    action: 'promoted',
    memoryId: randomUUID(),
    tenantId: DEFAULT_TENANT,
    actor: { type: 'human', id: 'user-1', name: 'Test User' },
    reason: 'Passed all governance rules',
    details: {},
    timestamp: FIXED_NOW,
    ...overrides,
  } satisfies AuditEvent;
}
