import { getQmdTenantIndexPath, getQmdCollectionIndexPath } from '../config.js';

/** Get the data directory for a tenant's qmd index */
export function getTenantDataDir(tenantId: string): string {
  return getQmdTenantIndexPath(tenantId);
}

/** Get the data directory for a specific collection within a tenant */
export function getCollectionDataDir(tenantId: string, collection: string): string {
  return getQmdCollectionIndexPath(tenantId, collection);
}
