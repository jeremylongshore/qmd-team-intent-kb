import { describe, it, expect } from 'vitest';
import { MemoryCandidate } from '@qmd-team-intent-kb/schema';
import { buildCandidate } from '../capture/candidate-builder.js';
import type { RawCaptureEvent, GitContext } from '../types.js';

const makeEvent = (overrides?: Partial<RawCaptureEvent>): RawCaptureEvent => ({
  content: 'Use Result<T, E> for all fallible operations',
  title: 'Error handling convention',
  source: 'claude_session',
  category: 'convention',
  sessionId: 'sess-123',
  filePaths: ['src/lib.ts'],
  language: 'typescript',
  ...overrides,
});

const makeGitContext = (overrides?: Partial<GitContext>): GitContext => ({
  repoUrl: 'https://github.com/org/repo.git',
  branch: 'main',
  userName: 'Dev User',
  tenantId: 'org-repo',
  ...overrides,
});

describe('buildCandidate', () => {
  it('builds a valid MemoryCandidate', () => {
    const result = buildCandidate(makeEvent(), makeGitContext());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.candidate.status).toBe('inbox');
      expect(result.value.candidate.source).toBe('claude_session');
      expect(result.value.candidate.tenantId).toBe('org-repo');
    }
  });

  it('validates against MemoryCandidate schema', () => {
    const result = buildCandidate(makeEvent(), makeGitContext());
    expect(result.ok).toBe(true);
    if (result.ok) {
      const reparse = MemoryCandidate.safeParse(result.value.candidate);
      expect(reparse.success).toBe(true);
    }
  });

  it('generates a content hash', () => {
    const result = buildCandidate(makeEvent(), makeGitContext());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.contentHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('detects secrets in content', () => {
    const result = buildCandidate(
      makeEvent({ content: 'Use key AKIAIOSFODNN7EXAMPLE for AWS' }),
      makeGitContext(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.secretsDetected).toBe(true);
      expect(result.value.candidate.prePolicyFlags.potentialSecret).toBe(true);
    }
  });

  it('reports no secrets for clean content', () => {
    const result = buildCandidate(makeEvent(), makeGitContext());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.secretsDetected).toBe(false);
      expect(result.value.candidate.prePolicyFlags.potentialSecret).toBe(false);
    }
  });

  it('uses default tenantId when git context is null', () => {
    const result = buildCandidate(makeEvent(), null);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.candidate.tenantId).toBe('unknown');
    }
  });

  it('preserves metadata from event and git context', () => {
    const result = buildCandidate(makeEvent(), makeGitContext());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.candidate.metadata.filePaths).toEqual(['src/lib.ts']);
      expect(result.value.candidate.metadata.language).toBe('typescript');
      expect(result.value.candidate.metadata.repoUrl).toBe('https://github.com/org/repo.git');
      expect(result.value.candidate.metadata.branch).toBe('main');
    }
  });

  it('returns error for invalid input (empty content)', () => {
    const result = buildCandidate(makeEvent({ content: '' }), makeGitContext());
    expect(result.ok).toBe(false);
  });

  it('defaults trustLevel to medium', () => {
    const result = buildCandidate(makeEvent(), makeGitContext());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.candidate.trustLevel).toBe('medium');
    }
  });

  it('respects explicit trustLevel', () => {
    const result = buildCandidate(makeEvent({ trustLevel: 'high' }), makeGitContext());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.candidate.trustLevel).toBe('high');
    }
  });

  it('uses repoName from enriched GitContext as projectContext when event has none', () => {
    const result = buildCandidate(
      makeEvent({ projectContext: undefined }),
      makeGitContext({ repoName: 'my-repo' }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.candidate.metadata.projectContext).toBe('my-repo');
    }
  });

  it('event projectContext takes precedence over enriched repoName', () => {
    const result = buildCandidate(
      makeEvent({ projectContext: 'explicit-project' }),
      makeGitContext({ repoName: 'my-repo' }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.candidate.metadata.projectContext).toBe('explicit-project');
    }
  });

  it('enriched commitSha is preserved on GitContext', () => {
    const commitSha = 'a'.repeat(40);
    const ctx = makeGitContext({ commitSha });
    expect(ctx.commitSha).toBe(commitSha);
  });

  it('projectContext remains undefined when event has none and repoName absent', () => {
    const result = buildCandidate(
      makeEvent({ projectContext: undefined }),
      makeGitContext({ repoName: undefined }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.candidate.metadata.projectContext).toBeUndefined();
    }
  });
});
