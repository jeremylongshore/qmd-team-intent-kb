import type { SecretMatch, SecretPattern } from '../types.js';
import { SECRET_PATTERNS } from './patterns.js';

/** Scan content for secret patterns. Pure function — no side effects. */
export function scanForSecrets(
  content: string,
  patterns: SecretPattern[] = SECRET_PATTERNS,
): SecretMatch[] {
  const matches: SecretMatch[] = [];
  const lines = content.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]!;
    for (const pattern of patterns) {
      const match = pattern.regex.exec(line);
      if (match) {
        matches.push({
          patternId: pattern.id,
          patternName: pattern.name,
          line: lineIdx + 1,
          column: match.index + 1,
          matchLength: match[0].length,
        });
      }
    }
  }

  return matches;
}

/** Check if content contains any secrets */
export function hasSecrets(content: string, patterns: SecretPattern[] = SECRET_PATTERNS): boolean {
  return scanForSecrets(content, patterns).length > 0;
}
