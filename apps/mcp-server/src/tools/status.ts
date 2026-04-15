import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createDatabase, MemoryRepository } from '@qmd-team-intent-kb/store';
import type { FeedbackEntry } from '@qmd-team-intent-kb/edge-daemon';
import type { McpServerConfig } from '../config.js';

/** Database-derived counts */
interface MemoryCounts {
  byLifecycle: Record<string, number>;
  byCategory: Record<string, number>;
  byTenant: Record<string, number>;
  total: number;
}

/** Aggregate status response */
interface StatusResult {
  counts: MemoryCounts;
  recentFeedback: FeedbackEntry[];
  dbPath: string;
}

/**
 * Read recent feedback entries from the feedback directory.
 *
 * Inlined from edge-daemon's readRecentFeedback to accept an explicit path
 * rather than reading from the global TEAMKB_BASE_PATH env var. This keeps
 * status.ts testable without env mutation.
 */
function readFeedback(feedbackPath: string, limit: number = 10): FeedbackEntry[] {
  let files: string[];
  try {
    files = readdirSync(feedbackPath)
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
      const content = readFileSync(join(feedbackPath, file), 'utf8');
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

/**
 * Read memory counts from SQLite in read-only mode and return recent feedback.
 *
 * Opens a short-lived read-only connection — does not hold the DB open between
 * calls, so the write path is never blocked.
 */
export function getStatus(config: McpServerConfig): StatusResult {
  let counts: MemoryCounts;

  try {
    const db = createDatabase({ path: config.dbPath, readonly: true });
    try {
      const repo = new MemoryRepository(db);
      const byLifecycle = repo.countByLifecycle();
      const byCategory = repo.countByCategory();
      const byTenant = repo.countByTenant();
      const total = repo.count();
      counts = { byLifecycle, byCategory, byTenant, total };
    } finally {
      db.close();
    }
  } catch {
    // DB doesn't exist yet or is inaccessible — return empty counts
    counts = { byLifecycle: {}, byCategory: {}, byTenant: {}, total: 0 };
  }

  const recentFeedback = readFeedback(config.feedbackPath);

  return { counts, recentFeedback, dbPath: config.dbPath };
}
