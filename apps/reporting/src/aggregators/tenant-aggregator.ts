import type {
  MemoryRepository,
  AuditRepository,
  CandidateRepository,
} from '@qmd-team-intent-kb/store';
import type { TenantSummary } from '../types.js';

/**
 * Aggregate per-tenant summaries: memory count, candidate count, audit actions.
 * Discovers tenants from the union of memory and candidate tenant IDs.
 */
export function aggregateTenants(
  memoryRepo: MemoryRepository,
  candidateRepo: CandidateRepository,
  auditRepo: AuditRepository,
): TenantSummary[] {
  const memoryCountsByTenant = memoryRepo.countByTenant();
  const candidateCountsByTenant = candidateRepo.countByTenant();

  const tenantIds = new Set<string>([
    ...Object.keys(memoryCountsByTenant),
    ...Object.keys(candidateCountsByTenant),
  ]);

  const summaries: TenantSummary[] = [];

  for (const tenantId of tenantIds) {
    const memoryCount = memoryCountsByTenant[tenantId] ?? 0;
    const candidateCount = candidateCountsByTenant[tenantId] ?? 0;
    const auditActions = auditRepo.countByTenantAndAction(tenantId);

    summaries.push({ tenantId, memoryCount, candidateCount, auditActions });
  }

  summaries.sort((a, b) => a.tenantId.localeCompare(b.tenantId));

  return summaries;
}
