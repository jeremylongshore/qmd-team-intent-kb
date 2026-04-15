import { describe, it, expect } from 'vitest';
import { filterByRepoScope } from '../repo-scope.js';
import { makeCandidate, RecordingLogger } from './fixtures.js';

const REMOTE = 'https://github.com/org/repo-a';

describe('filterByRepoScope', () => {
  it('keeps all candidates when all repoUrls match', () => {
    const candidates = [
      makeCandidate({ metadata: { filePaths: [], tags: [], repoUrl: REMOTE } }),
      makeCandidate({ metadata: { filePaths: [], tags: [], repoUrl: REMOTE } }),
    ];
    const logger = new RecordingLogger();

    const result = filterByRepoScope(candidates, REMOTE, logger);

    expect(result.kept).toHaveLength(2);
    expect(result.skipped).toBe(0);
    expect(logger.messages).toHaveLength(0);
  });

  it('skips candidates with a mismatched repoUrl and logs a warning', () => {
    const foreign = makeCandidate({
      metadata: { filePaths: [], tags: [], repoUrl: 'https://github.com/org/repo-b' },
    });
    const matching = makeCandidate({
      metadata: { filePaths: [], tags: [], repoUrl: REMOTE },
    });
    const logger = new RecordingLogger();

    const result = filterByRepoScope([foreign, matching], REMOTE, logger);

    expect(result.kept).toHaveLength(1);
    expect(result.kept[0]?.id).toBe(matching.id);
    expect(result.skipped).toBe(1);
    const warns = logger.messages.filter((m) => m.level === 'warn');
    expect(warns).toHaveLength(1);
    expect(warns[0]?.message).toContain(foreign.id);
    expect(warns[0]?.message).toContain('repo-scope');
  });

  it('keeps candidates that have no repoUrl (pre-tagging passthrough)', () => {
    const noUrl = makeCandidate({ metadata: { filePaths: [], tags: [] } });
    const logger = new RecordingLogger();

    const result = filterByRepoScope([noUrl], REMOTE, logger);

    expect(result.kept).toHaveLength(1);
    expect(result.skipped).toBe(0);
  });

  it('normalizes trailing .git before comparing', () => {
    const withGit = makeCandidate({
      metadata: { filePaths: [], tags: [], repoUrl: REMOTE + '.git' },
    });
    const logger = new RecordingLogger();

    const result = filterByRepoScope([withGit], REMOTE, logger);

    expect(result.kept).toHaveLength(1);
    expect(result.skipped).toBe(0);
  });

  it('comparison is case-insensitive', () => {
    const upper = makeCandidate({
      metadata: { filePaths: [], tags: [], repoUrl: REMOTE.toUpperCase() },
    });
    const logger = new RecordingLogger();

    const result = filterByRepoScope([upper], REMOTE, logger);

    expect(result.kept).toHaveLength(1);
    expect(result.skipped).toBe(0);
  });

  it('handles an empty candidate list', () => {
    const logger = new RecordingLogger();

    const result = filterByRepoScope([], REMOTE, logger);

    expect(result.kept).toHaveLength(0);
    expect(result.skipped).toBe(0);
  });

  it('skips multiple mismatches and logs each individually', () => {
    const candidates = [
      makeCandidate({ metadata: { filePaths: [], tags: [], repoUrl: 'https://github.com/org/x' } }),
      makeCandidate({ metadata: { filePaths: [], tags: [], repoUrl: 'https://github.com/org/y' } }),
    ];
    const logger = new RecordingLogger();

    const result = filterByRepoScope(candidates, REMOTE, logger);

    expect(result.kept).toHaveLength(0);
    expect(result.skipped).toBe(2);
    const warns = logger.messages.filter((m) => m.level === 'warn');
    expect(warns).toHaveLength(2);
  });
});
