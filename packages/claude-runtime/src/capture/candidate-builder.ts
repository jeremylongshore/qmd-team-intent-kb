import { randomUUID } from 'node:crypto';
import { MemoryCandidate } from '@qmd-team-intent-kb/schema';
import { computeContentHash } from '@qmd-team-intent-kb/common';
import type { Result } from '@qmd-team-intent-kb/common';
import type { RawCaptureEvent, GitContext } from '../types.js';
import { hasSecrets } from '../secrets/secret-scanner.js';

export interface CandidateBuildResult {
  candidate: ReturnType<typeof MemoryCandidate.parse>;
  contentHash: string;
  secretsDetected: boolean;
}

/** Build a MemoryCandidate from a raw capture event and git context */
export function buildCandidate(
  event: RawCaptureEvent,
  gitContext: GitContext | null,
): Result<CandidateBuildResult, string> {
  const secretsDetected = hasSecrets(event.content);
  const contentHash = computeContentHash(event.content);

  const input = {
    id: randomUUID(),
    status: 'inbox' as const,
    source: event.source,
    content: event.content,
    title: event.title,
    category: event.category,
    trustLevel: event.trustLevel ?? 'medium',
    author: {
      type: 'ai' as const,
      id: event.sessionId ?? 'unknown-session',
    },
    tenantId: gitContext?.tenantId ?? 'unknown',
    metadata: {
      filePaths: event.filePaths ?? [],
      language: event.language,
      projectContext: event.projectContext ?? gitContext?.repoName,
      sessionId: event.sessionId,
      repoUrl: gitContext?.repoUrl,
      branch: gitContext?.branch,
    },
    prePolicyFlags: {
      potentialSecret: secretsDetected,
    },
    capturedAt: new Date().toISOString(),
  };

  const parsed = MemoryCandidate.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: `Schema validation failed: ${parsed.error.message}` };
  }

  return {
    ok: true,
    value: {
      candidate: parsed.data,
      contentHash,
      secretsDetected,
    },
  };
}
