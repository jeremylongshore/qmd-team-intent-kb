import { describe, it, expect } from 'vitest';
import {
  formatReportAsMarkdown,
  formatTenantAsMarkdown,
  formatStaleReportAsMarkdown,
} from '../formatters/markdown-formatter.js';
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

describe('Markdown formatters', () => {
  it('formatReportAsMarkdown contains expected sections', () => {
    const md = formatReportAsMarkdown(REPORT);
    expect(md).toContain('# System Health Report');
    expect(md).toContain('## Lifecycle Distribution');
    expect(md).toContain('## Curation Outcomes');
    expect(md).toContain('## Knowledge Health');
    expect(md).toContain('## Tenants');
  });

  it('formatReportAsMarkdown includes correct data in tables', () => {
    const md = formatReportAsMarkdown(REPORT);
    expect(md).toContain('| active | 5 |');
    expect(md).toContain('| deprecated | 1 |');
    expect(md).toContain('| **Total** | **8** |');
    expect(md).toContain('Active rate: 62.5%');
  });

  it('formatReportAsMarkdown includes curation metrics', () => {
    const md = formatReportAsMarkdown(REPORT);
    expect(md).toContain('- Promoted: 5');
    expect(md).toContain('- Rejected: 1');
    expect(md).toContain('Promotion rate: 83.3%');
  });

  it('formatTenantAsMarkdown renders tenant details', () => {
    const summary: TenantSummary = {
      tenantId: 'team-alpha',
      memoryCount: 10,
      candidateCount: 5,
      auditActions: { promoted: 8, archived: 2 },
    };
    const md = formatTenantAsMarkdown(summary);
    expect(md).toContain('# Tenant Report: team-alpha');
    expect(md).toContain('- Memories: 10');
    expect(md).toContain('| promoted | 8 |');
  });

  it('formatStaleReportAsMarkdown renders stale details', () => {
    const report: StaleKnowledgeReport = {
      staleMemories: [
        {
          id: 'mem-1',
          title: 'Old Pattern',
          category: 'pattern',
          lastUpdated: '2025-01-01',
          tenantId: 'a',
        },
      ],
      threshold: '2026-02-01T00:00:00.000Z',
      totalStale: 1,
    };
    const md = formatStaleReportAsMarkdown(report);
    expect(md).toContain('# Stale Knowledge Report');
    expect(md).toContain('Total stale: 1');
    expect(md).toContain('Old Pattern');
  });
});
