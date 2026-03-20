import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { isPathSafe } from '@qmd-team-intent-kb/common';

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

  const rawBasePath = process.env['TEAMKB_BASE_PATH'] ?? join(homedir(), '.teamkb');
  const basePath = resolve(rawBasePath);

  // Validate TEAMKB_BASE_PATH against path traversal (must be under home directory)
  const home = homedir();
  const pathCheck = isPathSafe(basePath, [home]);
  if (!pathCheck.safe) {
    throw new Error(`TEAMKB_BASE_PATH is invalid: ${pathCheck.reason}`);
  }

  return {
    tenantId: tenantId.trim(),
    basePath,
    spoolPath: join(basePath, 'spool'),
    dbPath: join(basePath, 'teamkb.db'),
    feedbackPath: join(basePath, 'feedback'),
  };
}
