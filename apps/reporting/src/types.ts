/** Distribution of memories across lifecycle states */
export interface LifecycleReport {
  /** Count per lifecycle state (active, deprecated, superseded, archived) */
  distribution: Record<string, number>;
  /** Total memory count across all states */
  total: number;
  /** Percentage of memories in 'active' state */
  activeRate: number;
}

/** Curation pipeline outcomes from audit trail */
export interface CurationReport {
  /** Total promotion events */
  promoted: number;
  /** Total rejection/demotion events */
  rejected: number;
  /** Total supersession events */
  superseded: number;
  /** Total archival events */
  archived: number;
  /** Promotion rate: promoted / (promoted + rejected) or 0 if none */
  promotionRate: number;
}

/** Freshness and coverage analysis */
export interface KnowledgeHealthReport {
  /** Number of active memories not updated within the staleness threshold */
  staleCount: number;
  /** IDs of stale memories */
  staleIds: string[];
  /** Count per category for active memories */
  categoryCoverage: Record<string, number>;
  /** Freshness score: 1 - (staleCount / totalActive) clamped to [0, 1] */
  freshnessScore: number;
  /** Total active memories */
  totalActive: number;
}

/** Per-tenant summary */
export interface TenantSummary {
  tenantId: string;
  memoryCount: number;
  candidateCount: number;
  /** Audit action distribution for this tenant */
  auditActions: Record<string, number>;
}

/** Aggregate system health */
export interface SystemHealthReport {
  lifecycle: LifecycleReport;
  curation: CurationReport;
  health: KnowledgeHealthReport;
  tenants: TenantSummary[];
  generatedAt: string;
}

/** Stale knowledge detail report */
export interface StaleKnowledgeReport {
  staleMemories: Array<{
    id: string;
    title: string;
    category: string;
    lastUpdated: string;
    tenantId: string;
  }>;
  threshold: string;
  totalStale: number;
}
