// Edge Daemon — local spool watch, curation, and index sync
export type {
  DaemonConfig,
  DaemonDependencies,
  CycleResult,
  DaemonState,
  DaemonLogger,
  IngestStepResult,
  IndexUpdateResult,
  StalenessSweepResult,
} from './types.js';
export { loadDaemonConfig } from './config.js';
export { acquireLock, releaseLock, isLocked } from './lock.js';
export { ConsoleDaemonLogger, NullLogger } from './health.js';
export { PinoDaemonLogger } from './pino-logger.js';
export { runCycle } from './cycle.js';
export { runStalenessSweep } from './staleness.js';
export { EdgeDaemon } from './daemon.js';
export { HealthServer } from './health-server.js';
export type { HealthServerOptions } from './health-server.js';
export { writeFeedback, readRecentFeedback, getFeedbackPath } from './feedback.js';
export type { FeedbackEntry } from './feedback.js';
