import { createHash } from 'node:crypto';

/** Compute a SHA-256 hex hash of the given content string */
export function computeContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}
