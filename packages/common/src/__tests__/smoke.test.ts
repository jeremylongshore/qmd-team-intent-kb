import { describe, it, expect } from 'vitest';
import { name } from '../index.js';

describe('common package', () => {
  it('exports the package name', () => {
    expect(name).toBe('@qmd-team-intent-kb/common');
  });
});
