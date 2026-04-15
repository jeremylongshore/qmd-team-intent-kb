import { classifyContent } from '@qmd-team-intent-kb/claude-runtime';
import type { SensitivityLevel } from '@qmd-team-intent-kb/claude-runtime';
import { Sensitivity } from '@qmd-team-intent-kb/schema';
import type { MemoryCandidate, PolicyRule } from '@qmd-team-intent-kb/schema';
import type { EvaluationContext, RuleResult } from '../types.js';

const VALID_LEVELS = new Set<string>(Sensitivity.options);

/** Default blocked sensitivity levels */
const DEFAULT_BLOCKED_LEVELS: SensitivityLevel[] = ['restricted', 'confidential'];

/** Extract blockedLevels from rule parameters with runtime validation */
function parseBlockedLevels(params: Record<string, unknown> | undefined): SensitivityLevel[] {
  if (!params || !Array.isArray(params['blockedLevels'])) return DEFAULT_BLOCKED_LEVELS;
  const levels = params['blockedLevels'].filter(
    (v): v is SensitivityLevel => typeof v === 'string' && VALID_LEVELS.has(v),
  );
  return levels.length > 0 ? levels : DEFAULT_BLOCKED_LEVELS;
}

/**
 * Rule evaluator that gates promotion based on content sensitivity.
 * Uses the content classifier to determine sensitivity level and blocks
 * promotion if the level is in the configured blockedLevels list.
 *
 * Parameters:
 * - blockedLevels: string[] — sensitivity levels to block (default: ['restricted', 'confidential'])
 */
export function evaluateSensitivityGate(
  candidate: MemoryCandidate,
  rule: PolicyRule,
  _context: EvaluationContext,
): RuleResult {
  const classification = classifyContent(candidate.content);
  const blockedLevels = parseBlockedLevels(rule.parameters);

  const isBlocked = blockedLevels.includes(classification.sensitivityLevel);

  if (!isBlocked) {
    return {
      ruleId: rule.id,
      ruleType: rule.type,
      outcome: 'pass',
      reason: `Content sensitivity level '${classification.sensitivityLevel}' is allowed`,
    };
  }

  return {
    ruleId: rule.id,
    ruleType: rule.type,
    outcome: 'fail',
    reason: `Content blocked — sensitivity level '${classification.sensitivityLevel}' is restricted. Matched patterns: ${classification.matchedPatterns.join(', ')}`,
  };
}
