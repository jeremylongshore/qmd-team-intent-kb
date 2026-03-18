import { describe, it, expect } from 'vitest';
import { ok, err, computeContentHash, resolveTeamKbPath } from '../index.js';

describe('common package', () => {
  it('exports Result helpers', () => {
    expect(ok(1).ok).toBe(true);
    expect(err('fail').ok).toBe(false);
  });

  it('exports computeContentHash', () => {
    expect(typeof computeContentHash).toBe('function');
  });

  it('exports resolveTeamKbPath', () => {
    expect(typeof resolveTeamKbPath).toBe('function');
  });
});
