import type { MemoryCandidate, PolicyRule } from '@qmd-team-intent-kb/schema';
import type { EvaluationContext, RuleResult } from '../types.js';

/** Default sanitization patterns */
const DEFAULT_PATTERNS: Array<{ id: string; regex: RegExp; description: string }> = [
  {
    id: 'unix-home-path',
    regex: /\/home\/[a-zA-Z0-9_.-]+\//,
    description: 'Unix home directory path',
  },
  {
    id: 'macos-user-path',
    regex: /\/Users\/[a-zA-Z0-9_.-]+\//,
    description: 'macOS user directory path',
  },
  {
    id: 'windows-path',
    regex: /[A-Z]:\\/,
    description: 'Windows absolute path',
  },
  {
    id: 'internal-hostname',
    regex: /[a-zA-Z0-9-]+\.internal\b/,
    description: 'Internal hostname (.internal)',
  },
  {
    id: 'local-hostname',
    regex: /[a-zA-Z0-9-]+\.local\b/,
    description: 'Local hostname (.local)',
  },
  {
    id: 'rfc1918-ip',
    regex:
      /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/,
    description: 'RFC 1918 private IP address',
  },
];

/**
 * Rule evaluator that detects leaked internal paths, hostnames, and private IPs.
 * Configurable via rule.parameters.enabledPatterns (string[] of pattern IDs).
 * If not configured, all patterns are enabled by default.
 */
export function evaluateContentSanitization(
  candidate: MemoryCandidate,
  rule: PolicyRule,
  _context: EvaluationContext,
): RuleResult {
  const params = rule.parameters as Record<string, unknown> | undefined;
  const enabledPatternIds =
    params && Array.isArray(params['enabledPatterns'])
      ? (params['enabledPatterns'].filter((v): v is string => typeof v === 'string') as
          | string[]
          | undefined)
      : undefined;

  const patterns =
    enabledPatternIds !== undefined
      ? DEFAULT_PATTERNS.filter((p) => enabledPatternIds.includes(p.id))
      : DEFAULT_PATTERNS;

  const matched: string[] = [];

  for (const pattern of patterns) {
    if (pattern.regex.test(candidate.content)) {
      matched.push(pattern.id);
    }
  }

  if (matched.length === 0) {
    return {
      ruleId: rule.id,
      ruleType: rule.type,
      outcome: 'pass',
      reason: 'No internal paths, hostnames, or private IPs detected',
    };
  }

  return {
    ruleId: rule.id,
    ruleType: rule.type,
    outcome: 'flag',
    reason: `Content contains internal references: ${matched.join(', ')}`,
  };
}
