import type { SystemHealthReport, TenantSummary, StaleKnowledgeReport } from '../types.js';

/** Format a system health report as human-readable Markdown */
export function formatReportAsMarkdown(report: SystemHealthReport): string {
  const lines: string[] = [];

  lines.push('# System Health Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');

  // Lifecycle distribution
  lines.push('## Lifecycle Distribution');
  lines.push('');
  lines.push('| State | Count |');
  lines.push('|-------|-------|');
  for (const [state, count] of Object.entries(report.lifecycle.distribution)) {
    lines.push(`| ${state} | ${String(count)} |`);
  }
  lines.push(`| **Total** | **${String(report.lifecycle.total)}** |`);
  lines.push('');
  lines.push(`Active rate: ${(report.lifecycle.activeRate * 100).toFixed(1)}%`);
  lines.push('');

  // Curation outcomes
  lines.push('## Curation Outcomes');
  lines.push('');
  lines.push(`- Promoted: ${String(report.curation.promoted)}`);
  lines.push(`- Rejected: ${String(report.curation.rejected)}`);
  lines.push(`- Superseded: ${String(report.curation.superseded)}`);
  lines.push(`- Archived: ${String(report.curation.archived)}`);
  lines.push(`- Promotion rate: ${(report.curation.promotionRate * 100).toFixed(1)}%`);
  lines.push('');

  // Knowledge health
  lines.push('## Knowledge Health');
  lines.push('');
  lines.push(`- Active memories: ${String(report.health.totalActive)}`);
  lines.push(`- Stale memories: ${String(report.health.staleCount)}`);
  lines.push(`- Freshness score: ${(report.health.freshnessScore * 100).toFixed(1)}%`);
  lines.push('');
  lines.push('### Category Coverage');
  lines.push('');
  lines.push('| Category | Count |');
  lines.push('|----------|-------|');
  for (const [category, count] of Object.entries(report.health.categoryCoverage)) {
    lines.push(`| ${category} | ${String(count)} |`);
  }
  lines.push('');

  // Tenants
  if (report.tenants.length > 0) {
    lines.push('## Tenants');
    lines.push('');
    lines.push('| Tenant | Memories | Candidates |');
    lines.push('|--------|----------|------------|');
    for (const tenant of report.tenants) {
      lines.push(
        `| ${tenant.tenantId} | ${String(tenant.memoryCount)} | ${String(tenant.candidateCount)} |`,
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

/** Format a tenant summary as human-readable Markdown */
export function formatTenantAsMarkdown(summary: TenantSummary): string {
  const lines: string[] = [];

  lines.push(`# Tenant Report: ${summary.tenantId}`);
  lines.push('');
  lines.push(`- Memories: ${String(summary.memoryCount)}`);
  lines.push(`- Candidates: ${String(summary.candidateCount)}`);
  lines.push('');

  if (Object.keys(summary.auditActions).length > 0) {
    lines.push('## Audit Actions');
    lines.push('');
    lines.push('| Action | Count |');
    lines.push('|--------|-------|');
    for (const [action, count] of Object.entries(summary.auditActions)) {
      lines.push(`| ${action} | ${String(count)} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/** Format a stale knowledge report as human-readable Markdown */
export function formatStaleReportAsMarkdown(report: StaleKnowledgeReport): string {
  const lines: string[] = [];

  lines.push('# Stale Knowledge Report');
  lines.push('');
  lines.push(`Threshold: ${report.threshold}`);
  lines.push(`Total stale: ${String(report.totalStale)}`);
  lines.push('');

  if (report.staleMemories.length > 0) {
    lines.push('| ID | Title | Category | Last Updated | Tenant |');
    lines.push('|----|-------|----------|--------------|--------|');
    for (const mem of report.staleMemories) {
      lines.push(
        `| ${mem.id} | ${mem.title} | ${mem.category} | ${mem.lastUpdated} | ${mem.tenantId} |`,
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}
