import { homedir } from 'node:os';
import { join } from 'node:path';

/** Runtime configuration for the control plane API */
export interface AppConfig {
  port: number;
  host: string;
  dbPath: string;
  logLevel: string;
}

/**
 * Load configuration from environment variables with sensible defaults.
 * The API port defaults to 3847, host to loopback, and database path
 * to ~/.teamkb/data/teamkb.db.
 */
export function loadConfig(): AppConfig {
  return {
    port: parseInt(process.env['TEAMKB_API_PORT'] ?? '3847', 10),
    host: process.env['TEAMKB_API_HOST'] ?? '127.0.0.1',
    dbPath: process.env['TEAMKB_DB_PATH'] ?? join(homedir(), '.teamkb', 'data', 'teamkb.db'),
    logLevel: process.env['TEAMKB_LOG_LEVEL'] ?? 'info',
  };
}
