import type { MemoryCandidate, GovernancePolicy, PolicyRule } from '@qmd-team-intent-kb/schema';

/** Result of evaluating a single rule against a candidate */
export interface RuleResult {
  ruleId: string;
  ruleType: string;
  outcome: 'pass' | 'fail' | 'flag';
  reason: string;
  score?: number; // for scoring rules (relevance, trust)
}

/** Context provided to rule evaluators */
export interface EvaluationContext {
  candidate: MemoryCandidate;
  policy: GovernancePolicy;
  existingHashes?: Set<string>; // for dedup checking
  tenantId?: string; // for tenant match validation
}

/** Function signature for a rule evaluator */
export type RuleEvaluator = (
  candidate: MemoryCandidate,
  rule: PolicyRule,
  context: EvaluationContext,
) => RuleResult;

/** Result of running the full pipeline */
export interface PipelineResult {
  candidateId: string;
  outcome: 'approved' | 'rejected' | 'flagged';
  evaluations: RuleResult[];
  rejectedBy?: string; // ruleId that caused rejection
  flaggedBy?: string[]; // ruleIds that flagged
}
