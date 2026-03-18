import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { computeContentHash } from '../hash.js';

describe('computeContentHash', () => {
  it('returns a 64-character hex string', () => {
    const hash = computeContentHash('hello world');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('matches Node crypto SHA-256 output', () => {
    const content = 'Use Result<T, E> for fallible operations';
    const expected = createHash('sha256').update(content, 'utf8').digest('hex');
    expect(computeContentHash(content)).toBe(expected);
  });

  it('produces different hashes for different content', () => {
    const hash1 = computeContentHash('content A');
    const hash2 = computeContentHash('content B');
    expect(hash1).not.toBe(hash2);
  });

  it('produces same hash for same content', () => {
    const hash1 = computeContentHash('deterministic');
    const hash2 = computeContentHash('deterministic');
    expect(hash1).toBe(hash2);
  });

  it('handles empty string', () => {
    const hash = computeContentHash('');
    expect(hash).toHaveLength(64);
    // Known SHA-256 of empty string
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('handles unicode content', () => {
    const hash = computeContentHash('こんにちは世界 🌍');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
