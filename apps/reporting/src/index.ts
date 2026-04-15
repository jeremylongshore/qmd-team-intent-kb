export type {
  LifecycleReport,
  CurationReport,
  KnowledgeHealthReport,
  TenantSummary,
  SystemHealthReport,
  StaleKnowledgeReport,
} from './types.js';

export { aggregateLifecycle } from './aggregators/lifecycle-aggregator.js';
export { aggregateCuration } from './aggregators/curation-aggregator.js';
export { aggregateKnowledgeHealth } from './aggregators/knowledge-health-aggregator.js';
export { aggregateTenants } from './aggregators/tenant-aggregator.js';

export {
  formatReportAsJson,
  formatTenantAsJson,
  formatStaleReportAsJson,
} from './formatters/json-formatter.js';
export {
  formatReportAsMarkdown,
  formatTenantAsMarkdown,
  formatStaleReportAsMarkdown,
} from './formatters/markdown-formatter.js';

export { Reporter } from './reporter.js';
export type { ReporterConfig } from './reporter.js';
