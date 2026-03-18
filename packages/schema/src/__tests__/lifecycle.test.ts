import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  ALLOWED_TRANSITIONS,
  isTransitionAllowed,
  validateTransition,
  getAllowedTransitionsFrom,
  TransitionRequest,
} from '../lifecycle.js';
import type { MemoryLifecycleState } from '../enums.js';
import { makeAuthor } from './fixtures.js';

const makeTransitionRequest = (
  overrides?: Partial<{
    reason: string;
    actor: { type: string; id: string };
    supersededBy: string;
  }>,
) =>
  TransitionRequest.parse({
    reason: 'No longer relevant',
    actor: makeAuthor(),
    ...overrides,
  });

describe('ALLOWED_TRANSITIONS', () => {
  it('active can transition to deprecated, superseded, archived', () => {
    expect(ALLOWED_TRANSITIONS.active).toEqual(['deprecated', 'superseded', 'archived']);
  });

  it('deprecated can transition to active, archived', () => {
    expect(ALLOWED_TRANSITIONS.deprecated).toEqual(['active', 'archived']);
  });

  it('superseded can transition to archived', () => {
    expect(ALLOWED_TRANSITIONS.superseded).toEqual(['archived']);
  });

  it('archived is terminal (no transitions)', () => {
    expect(ALLOWED_TRANSITIONS.archived).toEqual([]);
  });
});

describe('isTransitionAllowed', () => {
  const allowed: [MemoryLifecycleState, MemoryLifecycleState][] = [
    ['active', 'deprecated'],
    ['active', 'superseded'],
    ['active', 'archived'],
    ['deprecated', 'active'],
    ['deprecated', 'archived'],
    ['superseded', 'archived'],
  ];

  it.each(allowed)('%s → %s is allowed', (from, to) => {
    expect(isTransitionAllowed(from, to)).toBe(true);
  });

  const disallowed: [MemoryLifecycleState, MemoryLifecycleState][] = [
    ['active', 'active'],
    ['deprecated', 'deprecated'],
    ['deprecated', 'superseded'],
    ['superseded', 'active'],
    ['superseded', 'deprecated'],
    ['superseded', 'superseded'],
    ['archived', 'active'],
    ['archived', 'deprecated'],
    ['archived', 'superseded'],
    ['archived', 'archived'],
  ];

  it.each(disallowed)('%s → %s is NOT allowed', (from, to) => {
    expect(isTransitionAllowed(from, to)).toBe(false);
  });
});

describe('validateTransition', () => {
  it('returns valid for allowed transition with required fields', () => {
    const result = validateTransition('active', 'deprecated', makeTransitionRequest());
    expect(result).toEqual({ valid: true });
  });

  it('returns invalid for disallowed transition', () => {
    const result = validateTransition('archived', 'active', makeTransitionRequest());
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('not allowed');
    }
  });

  it('requires supersededBy for transition to superseded', () => {
    const result = validateTransition('active', 'superseded', makeTransitionRequest());
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('supersededBy');
    }
  });

  it('accepts transition to superseded with supersededBy', () => {
    const result = validateTransition(
      'active',
      'superseded',
      makeTransitionRequest({ supersededBy: randomUUID() }),
    );
    expect(result).toEqual({ valid: true });
  });

  it('validates active → archived', () => {
    const result = validateTransition('active', 'archived', makeTransitionRequest());
    expect(result).toEqual({ valid: true });
  });

  it('validates deprecated → active (un-deprecate)', () => {
    const result = validateTransition('deprecated', 'active', makeTransitionRequest());
    expect(result).toEqual({ valid: true });
  });

  it('validates deprecated → archived', () => {
    const result = validateTransition('deprecated', 'archived', makeTransitionRequest());
    expect(result).toEqual({ valid: true });
  });

  it('validates superseded → archived', () => {
    const result = validateTransition('superseded', 'archived', makeTransitionRequest());
    expect(result).toEqual({ valid: true });
  });

  it('rejects all transitions from archived', () => {
    const states: MemoryLifecycleState[] = ['active', 'deprecated', 'superseded', 'archived'];
    for (const to of states) {
      const result = validateTransition('archived', to, makeTransitionRequest());
      expect(result.valid).toBe(false);
    }
  });
});

describe('getAllowedTransitionsFrom', () => {
  it('returns correct transitions for active', () => {
    expect(getAllowedTransitionsFrom('active')).toEqual(['deprecated', 'superseded', 'archived']);
  });

  it('returns correct transitions for deprecated', () => {
    expect(getAllowedTransitionsFrom('deprecated')).toEqual(['active', 'archived']);
  });

  it('returns correct transitions for superseded', () => {
    expect(getAllowedTransitionsFrom('superseded')).toEqual(['archived']);
  });

  it('returns empty array for archived', () => {
    expect(getAllowedTransitionsFrom('archived')).toEqual([]);
  });

  it('returns a new array (not the original)', () => {
    const result = getAllowedTransitionsFrom('active');
    result.push('active');
    expect(getAllowedTransitionsFrom('active')).toEqual(['deprecated', 'superseded', 'archived']);
  });
});

describe('TransitionRequest', () => {
  it('parses valid request', () => {
    const result = TransitionRequest.parse({
      reason: 'Outdated information',
      actor: makeAuthor(),
    });
    expect(result.reason).toBe('Outdated information');
    expect(result.supersededBy).toBeUndefined();
  });

  it('accepts optional supersededBy', () => {
    const id = randomUUID();
    const result = TransitionRequest.parse({
      reason: 'Replaced',
      actor: makeAuthor(),
      supersededBy: id,
    });
    expect(result.supersededBy).toBe(id);
  });

  it('rejects empty reason', () => {
    expect(() => TransitionRequest.parse({ reason: '', actor: makeAuthor() })).toThrow();
  });

  it('rejects missing actor', () => {
    expect(() => TransitionRequest.parse({ reason: 'test' })).toThrow();
  });
});
