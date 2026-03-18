import { describe, it, expect } from 'vitest';
import { generateHookScript } from '../templates/hook-templates.js';

describe('generateHookScript', () => {
  it.each(['user', 'project', 'enterprise'] as const)(
    'generates valid bash for %s scope',
    (scope) => {
      const script = generateHookScript(scope);
      expect(script).toContain('#!/usr/bin/env bash');
      expect(script).toContain(`Scope: ${scope}`);
      expect(script).toContain('set -euo pipefail');
      expect(script).toContain('SPOOL_DIR');
      expect(script).toContain('mkdir -p');
    },
  );

  it('includes TEAMKB_BASE_PATH fallback', () => {
    const script = generateHookScript('user');
    expect(script).toContain('TEAMKB_BASE_PATH');
    expect(script).toContain('.teamkb');
  });
});
