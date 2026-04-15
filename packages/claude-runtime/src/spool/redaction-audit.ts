import { join } from 'node:path';
import type { Result } from '@qmd-team-intent-kb/common';
import type { SecretMatch } from '../types.js';
import { getRedactionAuditPath, getSpoolFilename } from '../config.js';
import { writeJsonlRecord } from './write-jsonl.js';

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

  return writeJsonlRecord(dir, filepath, record, 'Failed to write redaction audit');
}
