import type { CurationBatchResult } from '@qmd-team-intent-kb/curator';
import type { ExportResult } from '@qmd-team-intent-kb/git-exporter';
import type {
  CandidateRepository,
  MemoryRepository,
  PolicyRepository,
  AuditRepository,
  ExportStateRepository,
} from '@qmd-team-intent-kb/store';
import type { QmdAdapter } from '@qmd-team-intent-kb/qmd-adapter';

/** Configuration for the edge daemon */
export interface DaemonConfig {
  tenantId: string;
  /** Polling interval in milliseconds. Default 10_000. */
  pollIntervalMs: number;
  /** Maximum candidates ingested per cycle. Default 100. */
  maxCandidatesPerCycle: number;
  /** Maximum spool file size in bytes before skipping. Default 10MB. */
  maxSpoolFileSizeBytes: number;
  /** Whether to run git export after curation. Default true. */
  enableExport: boolean;
  /** Whether to update qmd index after export. Default true. */
  enableIndexUpdate: boolean;
  /** Spool directory path. Default ~/.teamkb/spool/. */
  spoolDir?: string;
  /** Export output directory. Default kb-export/. */
  exportOutputDir: string;
  /** Export target identifier. Default kb-export-default. */
  exportTargetId: string;
  /** Jaccard similarity threshold for supersession. Default 0.6. */
  supersessionThreshold: number;
  /** PID file path for locking. Default ~/.teamkb/daemon.pid. */
  pidFilePath: string;
  /** Injectable clock for deterministic tests. */
  nowFn?: () => string;
}

/** Repository dependencies injected into the daemon */
export interface DaemonDependencies {
  candidateRepo: CandidateRepository;
  memoryRepo: MemoryRepository;
  policyRepo: PolicyRepository;
  auditRepo: AuditRepository;
  exportStateRepo: ExportStateRepository;
  /** Optional — skip index update if absent. */
  qmdAdapter?: QmdAdapter;
}

/** Result of a single ingest step */
export interface IngestStepResult {
  ingested: number;
  errors: string[];
}

/** Result of a qmd index update step */
export interface IndexUpdateResult {
  ok: boolean;
  error?: string;
}

/** Aggregate result of one full daemon cycle */
export interface CycleResult {
  startedAt: string;
  completedAt: string;
  ingest: IngestStepResult;
  curation: CurationBatchResult | null;
  export: ExportResult | null;
  indexUpdate: IndexUpdateResult | null;
}

/** Daemon lifecycle state */
export type DaemonState = 'idle' | 'running' | 'stopping' | 'stopped';

/** Logger interface for daemon health/status output */
export interface DaemonLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}
