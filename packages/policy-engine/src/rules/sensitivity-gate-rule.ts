import { classifyContent } from '@qmd-team-intent-kb/claude-runtime';
import type { SensitivityLevel } from '@qmd-team-intent-kb/claude-runtime';
import type { MemoryCandidate, PolicyRule } from '@qmd-team-intent-kb/schema';
import type { EvaluationContext, RuleResult } from '../types.js';

/** Default blocked sensitivity levels */
const DEFAULT_BLOCKED_LEVELS: SensitivityLevel[] = ['restricted', 'confidential'];

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
  const params = rule.parameters as Record<string, unknown> | undefined;
  const blockedLevels =
    (params?.['blockedLevels'] as SensitivityLevel[] | undefined) ?? DEFAULT_BLOCKED_LEVELS;

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
