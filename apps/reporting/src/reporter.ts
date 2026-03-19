import type {
  MemoryRepository,
  AuditRepository,
  CandidateRepository,
} from '@qmd-team-intent-kb/store';
import type { SystemHealthReport, TenantSummary, StaleKnowledgeReport } from './types.js';
import { aggregateLifecycle } from './aggregators/lifecycle-aggregator.js';
import { aggregateCuration } from './aggregators/curation-aggregator.js';
import { aggregateKnowledgeHealth } from './aggregators/knowledge-health-aggregator.js';
import { aggregateTenants } from './aggregators/tenant-aggregator.js';

/** Configuration for the reporter */
export interface ReporterConfig {
  /** Number of days without update to consider a memory stale (default 30) */
  staleDays?: number;
}

/**
 * Orchestrates all aggregators to produce comprehensive reports.
 * Reads from store repositories directly — no API dependency.
 */
export class Reporter {
  private readonly memoryRepo: MemoryRepository;
  private readonly auditRepo: AuditRepository;
  private readonly candidateRepo: CandidateRepository;
  private readonly config: Required<ReporterConfig>;

  constructor(
    memoryRepo: MemoryRepository,
    auditRepo: AuditRepository,
    candidateRepo: CandidateRepository,
    config: ReporterConfig = {},
  ) {
    this.memoryRepo = memoryRepo;
    this.auditRepo = auditRepo;
    this.candidateRepo = candidateRepo;
    this.config = { staleDays: config.staleDays ?? 30 };
  }

  /**
   * Generate a full system health report covering lifecycle, curation,
   * knowledge health, and per-tenant summaries.
   */
  generateSystemReport(nowFn: () => string = () => new Date().toISOString()): SystemHealthReport {
    const lifecycle = aggregateLifecycle(this.memoryRepo);
    const curation = aggregateCuration(this.auditRepo);
    const health = aggregateKnowledgeHealth(this.memoryRepo, this.config.staleDays, nowFn);
    const tenants = aggregateTenants(this.memoryRepo, this.candidateRepo, this.auditRepo);

    return {
      lifecycle,
      curation,
      health,
      tenants,
      generatedAt: nowFn(),
    };
  }

  /**
   * Generate a report for a specific tenant.
   * Returns null if the tenant has no memories or candidates.
   */
  generateTenantReport(tenantId: string): TenantSummary | null {
    const memoryCounts = this.memoryRepo.countByTenant();
    const candidateCounts = this.candidateRepo.countByTenant();
    const memoryCount = memoryCounts[tenantId] ?? 0;
    const candidateCount = candidateCounts[tenantId] ?? 0;

    if (memoryCount === 0 && candidateCount === 0) {
      return null;
    }

    const auditActions = this.auditRepo.countByTenantAndAction(tenantId);

    return { tenantId, memoryCount, candidateCount, auditActions };
  }

  /**
   * Generate a detailed stale knowledge report.
   */
  generateStaleReport(nowFn: () => string = () => new Date().toISOString()): StaleKnowledgeReport {
    const now = new Date(nowFn());
    const threshold = new Date(now.getTime() - this.config.staleDays * 24 * 60 * 60 * 1000);
    const olderThan = threshold.toISOString();

    const staleMemories = this.memoryRepo.findStale(olderThan).map((m) => ({
      id: m.id,
      title: m.title,
      category: m.category,
      lastUpdated: m.updatedAt,
      tenantId: m.tenantId,
    }));

    return {
      staleMemories,
      threshold: olderThan,
      totalStale: staleMemories.length,
    };
  }
}
