import type { SystemHealthReport, TenantSummary, StaleKnowledgeReport } from '../types.js';

/** Format a system health report as structured JSON with 2-space indent */
export function formatReportAsJson(report: SystemHealthReport): string {
  return JSON.stringify(report, null, 2);
}

/** Format a tenant summary as structured JSON with 2-space indent */
export function formatTenantAsJson(summary: TenantSummary): string {
  return JSON.stringify(summary, null, 2);
}

/** Format a stale knowledge report as structured JSON with 2-space indent */
export function formatStaleReportAsJson(report: StaleKnowledgeReport): string {
  return JSON.stringify(report, null, 2);
}
