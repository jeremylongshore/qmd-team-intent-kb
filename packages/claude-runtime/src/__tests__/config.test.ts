import { describe, it, expect } from 'vitest';
import { getSpoolFilename, SPOOL_DIR, FAILED_DIR, REDACTION_AUDIT_DIR } from '../config.js';

describe('config', () => {
  it('exports bucket directory names', () => {
    expect(SPOOL_DIR).toBe('spool');
    expect(FAILED_DIR).toBe('failed');
    expect(REDACTION_AUDIT_DIR).toBe('redaction-audit');
  });

  describe('getSpoolFilename', () => {
    it('returns a dated JSONL filename', () => {
      const filename = getSpoolFilename();
      expect(filename).toMatch(/^spool-\d{4}-\d{2}-\d{2}\.jsonl$/);
    });

    it('uses provided date', () => {
      const date = new Date('2026-03-15T12:00:00Z');
      expect(getSpoolFilename(date)).toBe('spool-2026-03-15.jsonl');
    });
  });
});
