import { describe, it, expect } from 'vitest';
import { isPathSafe } from '../path-safety.js';

describe('isPathSafe', () => {
  it('relative path docs/file.md is safe', () => {
    const result = isPathSafe('docs/file.md');
    expect(result.safe).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('path containing ".." is unsafe', () => {
    const result = isPathSafe('docs/../../../etc/passwd');
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('..');
  });

  it('path containing a null byte is unsafe', () => {
    const result = isPathSafe('docs/file\0.md');
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('null byte');
  });

  it('absolute path /etc/passwd without allowedRoots is unsafe', () => {
    const result = isPathSafe('/etc/passwd');
    expect(result.safe).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('absolute path under allowedRoot is safe', () => {
    const result = isPathSafe('/home/user/docs/file.md', ['/home/user']);
    expect(result.safe).toBe(true);
  });

  it('absolute path outside allowedRoots is unsafe', () => {
    const result = isPathSafe('/etc/passwd', ['/home/user']);
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('allowed root');
  });
});
