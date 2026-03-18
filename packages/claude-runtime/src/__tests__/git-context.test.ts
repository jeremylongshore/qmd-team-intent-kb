import { describe, it, expect } from 'vitest';
import { deriveTenantId } from '../capture/git-context.js';

describe('deriveTenantId', () => {
  it('extracts org-repo from SSH URL', () => {
    expect(deriveTenantId('git@github.com:intent-solutions/project.git')).toBe(
      'intent-solutions-project',
    );
  });

  it('extracts org-repo from HTTPS URL', () => {
    expect(deriveTenantId('https://github.com/intent-solutions/project.git')).toBe(
      'intent-solutions-project',
    );
  });

  it('handles URLs without .git suffix', () => {
    expect(deriveTenantId('https://github.com/org/repo')).toBe('org-repo');
  });

  it('handles SSH without .git suffix', () => {
    expect(deriveTenantId('git@github.com:org/repo')).toBe('org-repo');
  });

  it('falls back to raw URL if no pattern matches', () => {
    expect(deriveTenantId('some-local-path')).toBe('some-local-path');
  });
});
