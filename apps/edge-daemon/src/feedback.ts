import { writeFileSync, mkdirSync, readdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { resolveTeamKbPath } from '@qmd-team-intent-kb/common';
import type { CurationBatchResult } from '@qmd-team-intent-kb/curator';

const FEEDBACK_DIR = 'feedback';
const MAX_FEEDBACK_FILES = 50;

/** Feedback entry written for rejected/flagged candidates */
export interface FeedbackEntry {
  candidateId: string;
  outcome: string;
  reason: string;
  timestamp: string;
}

/** Get the absolute feedback directory path */
export function getFeedbackPath(): string {
  return resolveTeamKbPath(FEEDBACK_DIR);
}

/**
 * Write rejection/flagging feedback to the feedback directory.
 *
 * Each curation cycle that produces rejections writes a single JSONL file.
 * The MCP `teamkb_status` tool reads these to show recent rejections.
 *
 * Old feedback files are pruned to keep the directory bounded.
 */
export function writeFeedback(
  batchResult: CurationBatchResult,
  nowFn: () => string = () => new Date().toISOString(),
): void {
  const entries: FeedbackEntry[] = [];
  const now = nowFn();

  for (const result of batchResult.results) {
    if (result.outcome === 'rejected' || result.outcome === 'flagged') {
      entries.push({
        candidateId: result.candidateId,
        outcome: result.outcome,
        reason: result.reason ?? 'No reason provided',
        timestamp: now,
      });
    }
  }

  if (entries.length === 0) return;

  const dir = getFeedbackPath();
  mkdirSync(dir, { recursive: true, mode: 0o700 });

  const filename = `feedback-${now.replace(/[:.]/g, '-')}.jsonl`;
  const content = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
  writeFileSync(join(dir, filename), content, { encoding: 'utf8', mode: 0o600 });

  // Prune old feedback files
  pruneFeedbackFiles(dir);
}

/**
 * Read recent feedback entries (most recent first).
 * Returns at most `limit` entries.
 */
export function readRecentFeedback(limit: number = 10): FeedbackEntry[] {
  const dir = getFeedbackPath();
  let files: string[];
  try {
    files = readdirSync(dir)
      .filter((f) => f.startsWith('feedback-'))
      .sort()
      .reverse();
  } catch {
    return []; // Feedback dir doesn't exist yet
  }

  const entries: FeedbackEntry[] = [];
  for (const file of files) {
    if (entries.length >= limit) break;
    try {
      const content = readFileSync(join(dir, file), 'utf8');
      for (const line of content.trim().split('\n')) {
        if (line && entries.length < limit) {
          entries.push(JSON.parse(line) as FeedbackEntry);
        }
      }
    } catch {
      // Skip corrupt files
    }
  }
  return entries;
}

/** Keep only the most recent MAX_FEEDBACK_FILES files */
function pruneFeedbackFiles(dir: string): void {
  try {
    const files = readdirSync(dir)
      .filter((f) => f.startsWith('feedback-'))
      .sort();
    while (files.length > MAX_FEEDBACK_FILES) {
      const oldest = files.shift()!;
      unlinkSync(join(dir, oldest));
    }
  } catch {
    // Best-effort pruning
  }
}
