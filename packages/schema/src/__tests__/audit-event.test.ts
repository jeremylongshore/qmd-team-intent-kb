import { describe, it, expect } from 'vitest';
import { AuditEvent } from '../audit-event.js';
import { makeAuditEvent } from './fixtures.js';

describe('AuditEvent', () => {
  it('parses a valid event', () => {
    const result = AuditEvent.parse(makeAuditEvent());
    expect(result.action).toBe('promoted');
    expect(result.tenantId).toBe('team-alpha');
  });

  it('accepts all audit actions', () => {
    const actions = [
      'promoted',
      'demoted',
      'superseded',
      'archived',
      'deleted',
      'searched',
      'exported',
    ] as const;
    for (const action of actions) {
      const result = AuditEvent.parse(makeAuditEvent({ action }));
      expect(result.action).toBe(action);
    }
  });

  it('defaults details to empty object', () => {
    const input = makeAuditEvent();
    delete (input as Record<string, unknown>)['details'];
    const result = AuditEvent.parse(input);
    expect(result.details).toEqual({});
  });

  it('accepts optional reason', () => {
    const input = makeAuditEvent();
    delete (input as Record<string, unknown>)['reason'];
    const result = AuditEvent.parse(input);
    expect(result.reason).toBeUndefined();
  });

  it('preserves custom details', () => {
    const result = AuditEvent.parse(
      makeAuditEvent({
        details: { previousState: 'active', newState: 'deprecated', policyId: 'p-123' },
      }),
    );
    expect(result.details).toEqual({
      previousState: 'active',
      newState: 'deprecated',
      policyId: 'p-123',
    });
  });

  it('rejects missing action', () => {
    const input = makeAuditEvent();
    delete (input as Record<string, unknown>)['action'];
    expect(() => AuditEvent.parse(input)).toThrow();
  });

  it('rejects missing memoryId', () => {
    const input = makeAuditEvent();
    delete (input as Record<string, unknown>)['memoryId'];
    expect(() => AuditEvent.parse(input)).toThrow();
  });

  it('rejects missing tenantId', () => {
    const input = makeAuditEvent();
    delete (input as Record<string, unknown>)['tenantId'];
    expect(() => AuditEvent.parse(input)).toThrow();
  });

  it('rejects missing actor', () => {
    const input = makeAuditEvent();
    delete (input as Record<string, unknown>)['actor'];
    expect(() => AuditEvent.parse(input)).toThrow();
  });

  it('rejects invalid action', () => {
    expect(() => AuditEvent.parse(makeAuditEvent({ action: 'created' as 'promoted' }))).toThrow();
  });

  it('rejects invalid memoryId', () => {
    expect(() => AuditEvent.parse(makeAuditEvent({ memoryId: 'not-uuid' }))).toThrow();
  });

  it('rejects invalid timestamp', () => {
    expect(() => AuditEvent.parse(makeAuditEvent({ timestamp: 'not-a-date' }))).toThrow();
  });
});
