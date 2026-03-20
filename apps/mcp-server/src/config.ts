import { join } from 'node:path';
import { homedir } from 'node:os';

/** Resolved configuration for the MCP server */
export interface McpServerConfig {
  /** Tenant identifier — scopes all operations */
  tenantId: string;
  /** Absolute path to the TeamKB base directory */
  basePath: string;
  /** Absolute path to the spool directory */
  spoolPath: string;
  /** Absolute path to the SQLite database file */
  dbPath: string;
  /** Absolute path to the feedback directory */
  feedbackPath: string;
}

/**
 * Resolve MCP server configuration from environment variables.
 *
 * Required:
 *   TEAMKB_TENANT_ID — tenant identifier
 *
 * Optional:
 *   TEAMKB_BASE_PATH — defaults to ~/.teamkb
 */
export function resolveConfig(): McpServerConfig {
  const tenantId = process.env['TEAMKB_TENANT_ID'];
  if (!tenantId || tenantId.trim() === '') {
    throw new Error('TEAMKB_TENANT_ID environment variable is required');
  }

  const basePath = process.env['TEAMKB_BASE_PATH'] ?? join(homedir(), '.teamkb');

  return {
    tenantId: tenantId.trim(),
    basePath,
    spoolPath: join(basePath, 'spool'),
    dbPath: join(basePath, 'teamkb.db'),
    feedbackPath: join(basePath, 'feedback'),
  };
}
