import { randomUUID } from 'node:crypto';
import type { MemoryLifecycleState } from '@qmd-team-intent-kb/schema';
import { validateTransition } from '@qmd-team-intent-kb/schema';
import { createDatabase, MemoryRepository, AuditRepository } from '@qmd-team-intent-kb/store';
import type { McpServerConfig } from '../config.js';

/** Input for teamkb_transition */
interface TransitionInput {
  memoryId: string;
  to: MemoryLifecycleState;
  reason: string;
  actor: string;
}

/** Result returned after a successful transition */
interface TransitionResult {
  memoryId: string;
  from: string;
  to: string;
  auditEventId: string;
  message: string;
}

/**
 * Apply a lifecycle transition to a curated memory.
 *
 * Opens a short-lived read-write connection, validates the transition against
 * the state machine, updates the lifecycle column, and writes an audit event —
 * all inside the same synchronous SQLite transaction.
 *
 * Only called for low-frequency user-initiated actions (deprecation, archival,
 * etc.), so the overhead of opening a connection per call is acceptable.
 */
export function applyTransition(
  input: TransitionInput,
  config: McpServerConfig,
  nowFn: () => string = () => new Date().toISOString(),
): TransitionResult {
  // Validate UUID format before opening the DB connection
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(input.memoryId)) {
    throw new Error(`Invalid memoryId: "${input.memoryId}" is not a valid UUID`);
  }

  const db = createDatabase({ path: config.dbPath });
  try {
    const memoryRepo = new MemoryRepository(db);
    const auditRepo = new AuditRepository(db);

    const memory = memoryRepo.findById(input.memoryId);
    if (memory === null) {
      throw new Error(`Memory not found: ${input.memoryId}`);
    }

    const transitionRequest = {
      reason: input.reason,
      actor: { type: 'human' as const, id: input.actor },
    };

    const validation = validateTransition(memory.lifecycle, input.to, transitionRequest);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const now = nowFn();
    const auditEventId = randomUUID();
    const fromState = memory.lifecycle;

    // Apply both writes in a single transaction for atomicity
    const applyFn = db.transaction(() => {
      memoryRepo.updateLifecycle(input.memoryId, input.to, now);
      auditRepo.insert({
        id: auditEventId,
        action:
          input.to === 'archived'
            ? 'archived'
            : input.to === 'superseded'
              ? 'superseded'
              : 'demoted',
        memoryId: input.memoryId,
        tenantId: memory.tenantId,
        actor: { type: 'human', id: input.actor },
        reason: input.reason,
        details: { from: fromState, to: input.to },
        timestamp: now,
      });
    });

    applyFn();

    return {
      memoryId: input.memoryId,
      from: fromState,
      to: input.to,
      auditEventId,
      message: `Memory transitioned from "${fromState}" to "${input.to}"`,
    };
  } finally {
    db.close();
  }
}
