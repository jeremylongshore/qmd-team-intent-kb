import type { MemoryLifecycleState } from './enums.js';
import { Author, NonEmptyString, Uuid } from './common.js';
import { z } from 'zod';

/** Metadata required for a lifecycle transition */
export const TransitionRequest = z.object({
  reason: NonEmptyString,
  actor: Author,
  supersededBy: Uuid.optional(),
});
export type TransitionRequest = z.infer<typeof TransitionRequest>;

/** All allowed transitions from each state */
export const ALLOWED_TRANSITIONS: Record<MemoryLifecycleState, MemoryLifecycleState[]> = {
  active: ['deprecated', 'superseded', 'archived'],
  deprecated: ['active', 'archived'],
  superseded: ['archived'],
  archived: [],
};

/** Check if a transition between two states is allowed */
export function isTransitionAllowed(from: MemoryLifecycleState, to: MemoryLifecycleState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Result of a transition validation */
export type TransitionValidationResult = { valid: true } | { valid: false; error: string };

/** Validate a lifecycle transition with full context */
export function validateTransition(
  from: MemoryLifecycleState,
  to: MemoryLifecycleState,
  request: TransitionRequest,
): TransitionValidationResult {
  if (!isTransitionAllowed(from, to)) {
    return {
      valid: false,
      error: `Transition from "${from}" to "${to}" is not allowed`,
    };
  }

  if (to === 'superseded' && !request.supersededBy) {
    return {
      valid: false,
      error: 'Transition to "superseded" requires supersededBy UUID',
    };
  }

  return { valid: true };
}

/** Get all states that can be transitioned to from the given state */
export function getAllowedTransitionsFrom(state: MemoryLifecycleState): MemoryLifecycleState[] {
  return [...ALLOWED_TRANSITIONS[state]];
}
