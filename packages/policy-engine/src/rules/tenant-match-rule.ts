import type { MemoryCandidate, PolicyRule } from '@qmd-team-intent-kb/schema';
import type { EvaluationContext, RuleResult } from '../types.js';

/**
 * Rule evaluator that enforces tenant isolation. When context.tenantId is set,
 * the candidate's tenantId must match exactly. If context.tenantId is not set,
 * the rule passes with no enforcement (opt-in boundary check).
 */
export function evaluateTenantMatch(
  candidate: MemoryCandidate,
  rule: PolicyRule,
  context: EvaluationContext,
): RuleResult {
  if (context.tenantId === undefined) {
    return {
      ruleId: rule.id,
      ruleType: rule.type,
      outcome: 'pass',
      reason: 'No tenantId in context — tenant enforcement not active',
    };
  }

  if (candidate.tenantId === context.tenantId) {
    return {
      ruleId: rule.id,
      ruleType: rule.type,
      outcome: 'pass',
      reason: `Tenant match confirmed: '${candidate.tenantId}'`,
    };
  }

  return {
    ruleId: rule.id,
    ruleType: rule.type,
    outcome: 'fail',
    reason: `Tenant mismatch: candidate tenant '${candidate.tenantId}' != expected '${context.tenantId}'`,
  };
}
