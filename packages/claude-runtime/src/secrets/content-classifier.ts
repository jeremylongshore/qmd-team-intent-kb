import { scanForSecrets } from './secret-scanner.js';
import { SECRET_PATTERNS, PII_PATTERNS } from './patterns.js';
import type { Sensitivity } from '@qmd-team-intent-kb/schema';
import type { SecretMatch } from '../types.js';

/**
 * Sensitivity levels ordered from most to least restrictive.
 * Alias for {@link Sensitivity} from `@qmd-team-intent-kb/schema` — the two
 * types are structurally identical and consolidated here.
 *
 * @deprecated Use `Sensitivity` from `@qmd-team-intent-kb/schema` directly.
 */
export type SensitivityLevel = Sensitivity;

/** Result of content classification */
export interface ContentClassification {
  sensitivityLevel: SensitivityLevel;
  matchedPatterns: string[];
  hasPii: boolean;
  hasCredentials: boolean;
  hasInternalPaths: boolean;
}

/** Patterns for detecting internal/absolute paths */
const INTERNAL_PATH_PATTERNS = [
  /\/home\/[a-zA-Z0-9_.-]+\//,
  /\/Users\/[a-zA-Z0-9_.-]+\//,
  /[A-Z]:\\/,
];

/**
 * Classify content by sensitivity level.
 *
 * Levels (highest wins):
 * - restricted: contains credentials (secret patterns match)
 * - confidential: contains PII (email, phone, SSN patterns match)
 * - internal: contains internal paths (/home/, /Users/, C:\)
 * - public: no sensitive content detected
 */
export function classifyContent(content: string): ContentClassification {
  const credentialMatches = scanForSecrets(content, SECRET_PATTERNS);
  const piiMatches = scanForSecrets(content, PII_PATTERNS);

  const hasCredentials = credentialMatches.length > 0;
  const hasPii = piiMatches.length > 0;

  let hasInternalPaths = false;
  for (const pattern of INTERNAL_PATH_PATTERNS) {
    if (pattern.test(content)) {
      hasInternalPaths = true;
      break;
    }
  }

  const allMatches: SecretMatch[] = [...credentialMatches, ...piiMatches];
  const matchedPatterns = [...new Set(allMatches.map((m) => m.patternId))];

  if (hasInternalPaths) {
    matchedPatterns.push('internal-path');
  }

  let sensitivityLevel: Sensitivity = 'public';

  if (hasInternalPaths) {
    sensitivityLevel = 'internal';
  }
  if (hasPii) {
    sensitivityLevel = 'confidential';
  }
  if (hasCredentials) {
    sensitivityLevel = 'restricted';
  }

  return {
    sensitivityLevel,
    matchedPatterns,
    hasPii,
    hasCredentials,
    hasInternalPaths,
  };
}
