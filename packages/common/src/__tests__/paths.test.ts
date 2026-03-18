import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { DEFAULT_TEAMKB_BASE, getTeamKbBasePath, resolveTeamKbPath } from '../paths.js';

describe('paths', () => {
  const originalEnv = process.env['TEAMKB_BASE_PATH'];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env['TEAMKB_BASE_PATH'];
    } else {
      process.env['TEAMKB_BASE_PATH'] = originalEnv;
    }
  });

  describe('DEFAULT_TEAMKB_BASE', () => {
    it('is ~/.teamkb', () => {
      expect(DEFAULT_TEAMKB_BASE).toBe(join(homedir(), '.teamkb'));
    });
  });

  describe('getTeamKbBasePath', () => {
    it('returns default when env not set', () => {
      delete process.env['TEAMKB_BASE_PATH'];
      expect(getTeamKbBasePath()).toBe(DEFAULT_TEAMKB_BASE);
    });

    it('returns env override when set', () => {
      process.env['TEAMKB_BASE_PATH'] = '/tmp/custom-teamkb';
      expect(getTeamKbBasePath()).toBe('/tmp/custom-teamkb');
    });
  });

  describe('resolveTeamKbPath', () => {
    it('joins subdir to base path', () => {
      delete process.env['TEAMKB_BASE_PATH'];
      expect(resolveTeamKbPath('spool')).toBe(join(DEFAULT_TEAMKB_BASE, 'spool'));
    });

    it('respects env override', () => {
      process.env['TEAMKB_BASE_PATH'] = '/tmp/custom';
      expect(resolveTeamKbPath('qmd-index')).toBe('/tmp/custom/qmd-index');
    });

    it('handles nested subdirs', () => {
      delete process.env['TEAMKB_BASE_PATH'];
      expect(resolveTeamKbPath('qmd-index/tenant-1/kb-curated')).toBe(
        join(DEFAULT_TEAMKB_BASE, 'qmd-index/tenant-1/kb-curated'),
      );
    });
  });
});
