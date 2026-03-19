import { describe, it, expect } from 'vitest';
import {
  formatReportAsJson,
  formatTenantAsJson,
  formatStaleReportAsJson,
} from '../formatters/json-formatter.js';
import type { SystemHealthReport, TenantSummary, StaleKnowledgeReport } from '../types.js';

const REPORT: SystemHealthReport = {
  lifecycle: {
    distribution: { active: 5, deprecated: 1, superseded: 0, archived: 2 },
    total: 8,
    activeRate: 0.625,
  },
  curation: { promoted: 5, rejected: 1, superseded: 0, archived: 2, promotionRate: 0.833 },
  health: {
    staleCount: 1,
    staleIds: ['mem-1'],
    categoryCoverage: { pattern: 3, decision: 2 },
    freshnessScore: 0.8,
    totalActive: 5,
  },
  tenants: [{ tenantId: 'team-alpha', memoryCount: 5, candidateCount: 3, auditActions: {} }],
  generatedAt: '2026-03-01T00:00:00.000Z',
};

describe('JSON formatters', () => {
  it('formatReportAsJson produces valid JSON with 2-space indent', () => {
    const json = formatReportAsJson(REPORT);
    const parsed = JSON.parse(json) as SystemHealthReport;
    expect(parsed.lifecycle.total).toBe(8);
    expect(json).toContain('  ');
  });

  it('formatTenantAsJson produces valid JSON', () => {
    const summary: TenantSummary = {
      tenantId: 'team-alpha',
      memoryCount: 5,
      candidateCount: 3,
      auditActions: { promoted: 3 },
    };
    const json = formatTenantAsJson(summary);
    const parsed = JSON.parse(json) as TenantSummary;
    expect(parsed.tenantId).toBe('team-alpha');
  });

  it('formatStaleReportAsJson produces valid JSON', () => {
    const report: StaleKnowledgeReport = {
      staleMemories: [
        { id: '1', title: 'Old', category: 'pattern', lastUpdated: '2025-01-01', tenantId: 'a' },
      ],
      threshold: '2026-02-01',
      totalStale: 1,
    };
    const json = formatStaleReportAsJson(report);
    const parsed = JSON.parse(json) as StaleKnowledgeReport;
    expect(parsed.totalStale).toBe(1);
  });
});
