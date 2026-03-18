import { mkdir, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Result } from '@qmd-team-intent-kb/common';
import type { SecretMatch } from '../types.js';
import { getRedactionAuditPath, getSpoolFilename } from '../config.js';

/** An audit record for a secret detection finding */
export interface RedactionAuditRecord {
  candidateId: string;
  matches: SecretMatch[];
  redactedAt: string;
}

/** Log a redaction audit record for a candidate with detected secrets */
export async function writeRedactionAudit(
  candidateId: string,
  matches: SecretMatch[],
  auditDir?: string,
): Promise<Result<string, string>> {
  const dir = auditDir ?? getRedactionAuditPath();
  const filename = `redaction-${getSpoolFilename().replace('spool-', '')}`;
  const filepath = join(dir, filename);

  const record: RedactionAuditRecord = {
    candidateId,
    matches,
    redactedAt: new Date().toISOString(),
  };

  try {
    await mkdir(dir, { recursive: true });
    await appendFile(filepath, JSON.stringify(record) + '\n', 'utf8');
    return { ok: true, value: filepath };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Failed to write redaction audit: ${msg}` };
  }
}
