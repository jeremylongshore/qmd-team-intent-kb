import { join } from 'node:path';
import { homedir } from 'node:os';

/** Default base path for TeamKB data */
export const DEFAULT_TEAMKB_BASE = join(homedir(), '.teamkb');

/** Resolve the TeamKB base path, respecting TEAMKB_BASE_PATH env override */
export function getTeamKbBasePath(): string {
  return process.env['TEAMKB_BASE_PATH'] ?? DEFAULT_TEAMKB_BASE;
}

/** Resolve a subdirectory under the TeamKB base path */
export function resolveTeamKbPath(subdir: string): string {
  return join(getTeamKbBasePath(), subdir);
}
