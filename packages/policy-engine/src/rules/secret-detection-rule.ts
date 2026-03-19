import { scanForSecrets } from '@qmd-team-intent-kb/claude-runtime';
import type { MemoryCandidate, PolicyRule } from '@qmd-team-intent-kb/schema';
import type { EvaluationContext, RuleResult } from '../types.js';

/**
 * Rule evaluator that scans candidate content for secrets using the claude-runtime
 * secret scanner. Any detected patterns cause a 'fail' outcome; clean content passes.
 */
export function evaluateSecretDetection(
  candidate: MemoryCandidate,
  rule: PolicyRule,
  _context: EvaluationContext,
): RuleResult {
  const matches = scanForSecrets(candidate.content);

  if (matches.length === 0) {
    return {
      ruleId: rule.id,
      ruleType: rule.type,
      outcome: 'pass',
      reason: 'No secrets detected in content',
    };
  }

  const patternIds = [...new Set(matches.map((m) => m.patternId))].join(', ');
  const patternNames = [...new Set(matches.map((m) => m.patternName))].join(', ');

  return {
    ruleId: rule.id,
    ruleType: rule.type,
    outcome: 'fail',
    reason: `Secrets detected — patterns matched: ${patternNames} (ids: ${patternIds})`,
  };
}
