import type Database from 'better-sqlite3';

/** Payload returned by the health endpoint. */
export interface HealthStatus {
  status: 'healthy' | 'degraded';
  uptime: number;
  dbConnected: boolean;
  version: string;
}

/**
 * Reports the operational health of the API process.
 * Checks database connectivity with a lightweight probe query.
 */
export class HealthService {
  private readonly startTime = Date.now();

  constructor(private readonly db: Database.Database) {}

  /** Perform a health check and return the current status. */
  check(): HealthStatus {
    let dbConnected = false;
    try {
      this.db.prepare('SELECT 1').get();
      dbConnected = true;
    } catch {
      // DB unavailable — status will be reported as degraded
    }

    return {
      status: dbConnected ? 'healthy' : 'degraded',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      dbConnected,
      version: '0.4.0',
    };
  }
}
