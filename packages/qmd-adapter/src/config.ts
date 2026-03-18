import { resolveTeamKbPath } from '@qmd-team-intent-kb/common';

/** Base directory for qmd indexes, isolated from personal qmd usage */
export const QMD_INDEX_DIR = 'qmd-index';

/** Get the dedicated qmd index base path */
export function getQmdIndexBasePath(): string {
  return resolveTeamKbPath(QMD_INDEX_DIR);
}

/** Get the index path for a specific tenant */
export function getQmdTenantIndexPath(tenantId: string): string {
  return resolveTeamKbPath(`${QMD_INDEX_DIR}/${tenantId}`);
}

/** Get the index path for a specific tenant + collection */
export function getQmdCollectionIndexPath(tenantId: string, collection: string): string {
  return resolveTeamKbPath(`${QMD_INDEX_DIR}/${tenantId}/${collection}`);
}

/** Adapter configuration */
export interface QmdAdapterConfig {
  tenantId: string;
  qmdBinary?: string;
  timeout?: number;
}

/** Default configuration values */
export const DEFAULT_QMD_BINARY = 'qmd';
export const DEFAULT_TIMEOUT = 30_000;
