import { describe, it, expect } from 'vitest';
import { generateClaudeMdBlock } from '../templates/claudemd-templates.js';

describe('generateClaudeMdBlock', () => {
  it('generates valid markdown', () => {
    const block = generateClaudeMdBlock('team-alpha');
    expect(block).toContain('## Team Memory');
    expect(block).toContain('team-alpha');
    expect(block).toContain('curated');
  });

  it('includes the tenant ID', () => {
    const block = generateClaudeMdBlock('org-myproject');
    expect(block).toContain('Tenant: org-myproject');
  });

  it('mentions secrets warning', () => {
    const block = generateClaudeMdBlock('test');
    expect(block).toContain('secret');
  });
});
