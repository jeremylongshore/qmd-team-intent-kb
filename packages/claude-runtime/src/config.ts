import { resolveTeamKbPath } from '@qmd-team-intent-kb/common';

/** Local spool bucket paths */
export const SPOOL_DIR = 'spool';
export const FAILED_DIR = 'failed';
export const REDACTION_AUDIT_DIR = 'redaction-audit';

/** Get the absolute spool directory path */
export function getSpoolPath(): string {
  return resolveTeamKbPath(SPOOL_DIR);
}

/** Get the absolute failed bucket path */
export function getFailedPath(): string {
  return resolveTeamKbPath(FAILED_DIR);
}

/** Get the absolute redaction audit path */
export function getRedactionAuditPath(): string {
  return resolveTeamKbPath(REDACTION_AUDIT_DIR);
}

/** Generate a dated spool filename */
export function getSpoolFilename(date?: Date): string {
  const d = date ?? new Date();
  const iso = d.toISOString().slice(0, 10);
  return `spool-${iso}.jsonl`;
}
