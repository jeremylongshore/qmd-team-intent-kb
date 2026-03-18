import { computeContentHash } from '@qmd-team-intent-kb/common';
import type { MemoryCandidate, PolicyRule } from '@qmd-team-intent-kb/schema';
import type { EvaluationContext, RuleResult } from '../types.js';

/**
 * Rule evaluator that detects exact duplicate content by comparing SHA-256 hashes.
 * Requires context.existingHashes to be populated for dedup to function; if not
 * provided the rule passes vacuously.
 */
export function evaluateDedupCheck(
  candidate: MemoryCandidate,
  rule: PolicyRule,
  context: EvaluationContext,
): RuleResult {
  if (context.existingHashes === undefined || context.existingHashes.size === 0) {
    return {
      ruleId: rule.id,
      ruleType: rule.type,
      outcome: 'pass',
      reason: 'No existing hashes provided — dedup check skipped',
    };
  }

  const hash = computeContentHash(candidate.content);

  if (context.existingHashes.has(hash)) {
    return {
      ruleId: rule.id,
      ruleType: rule.type,
      outcome: 'fail',
      reason: `Exact duplicate detected (hash: ${hash})`,
    };
  }

  return {
    ruleId: rule.id,
    ruleType: rule.type,
    outcome: 'pass',
    reason: `Content is unique (hash: ${hash})`,
  };
}
