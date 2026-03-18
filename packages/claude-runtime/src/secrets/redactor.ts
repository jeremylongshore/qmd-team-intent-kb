import type { SecretPattern } from '../types.js';
import { SECRET_PATTERNS } from './patterns.js';

/** Redact all secret matches in content, replacing with [REDACTED:{patternId}] */
export function redactSecrets(
  content: string,
  patterns: SecretPattern[] = SECRET_PATTERNS,
): string {
  let result = content;
  for (const pattern of patterns) {
    result = result.replace(
      new RegExp(pattern.regex.source, pattern.regex.flags + 'g'),
      `[REDACTED:${pattern.id}]`,
    );
  }
  return result;
}
