import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { computeContentHash } from '@qmd-team-intent-kb/common';
import type Database from 'better-sqlite3';
import { createTestDatabase } from '../database.js';
import { CandidateRepository } from '../repositories/candidate-repository.js';
import { makeCandidate } from './fixtures.js';

describe('CandidateRepository', () => {
  let db: Database.Database;
  let repo: CandidateRepository;

  beforeEach(() => {
    db = createTestDatabase();
    repo = new CandidateRepository(db);
  });

  it('inserts a candidate and retrieves it by id', () => {
    const { candidate, contentHash } = makeCandidate();
    repo.insert(candidate, contentHash);
    const found = repo.findById(candidate.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(candidate.id);
    expect(found?.content).toBe(candidate.content);
    expect(found?.title).toBe(candidate.title);
    expect(found?.status).toBe('inbox');
  });

  it('findByTenant returns only candidates for the matching tenant', () => {
    const { candidate: c1, contentHash: h1 } = makeCandidate({ tenantId: 'team-alpha' });
    const { candidate: c2, contentHash: h2 } = makeCandidate({
      tenantId: 'team-beta',
      content: 'different content',
    });
    repo.insert(c1, h1);
    repo.insert(c2, h2);

    const alphaResults = repo.findByTenant('team-alpha');
    expect(alphaResults).toHaveLength(1);
    expect(alphaResults[0]?.tenantId).toBe('team-alpha');

    const betaResults = repo.findByTenant('team-beta');
    expect(betaResults).toHaveLength(1);
    expect(betaResults[0]?.tenantId).toBe('team-beta');
  });

  it('findByContentHash returns the matching candidate', () => {
    const { candidate, contentHash } = makeCandidate();
    repo.insert(candidate, contentHash);
    const found = repo.findByContentHash(contentHash);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(candidate.id);
  });

  it('count returns the correct number of candidates', () => {
    expect(repo.count()).toBe(0);
    const { candidate: c1, contentHash: h1 } = makeCandidate();
    const { candidate: c2, contentHash: h2 } = makeCandidate({ content: 'second candidate' });
    repo.insert(c1, h1);
    expect(repo.count()).toBe(1);
    repo.insert(c2, h2);
    expect(repo.count()).toBe(2);
  });

  it('returns null for a non-existent id', () => {
    expect(repo.findById(randomUUID())).toBeNull();
  });

  it('preserves full metadata on insert and retrieval', () => {
    const { candidate, contentHash } = makeCandidate({
      metadata: {
        filePaths: ['src/api.ts', 'src/auth.ts'],
        language: 'typescript',
        projectContext: 'backend',
        tags: ['api', 'auth'],
      },
      prePolicyFlags: { potentialSecret: true, lowConfidence: false, duplicateSuspect: true },
    });
    repo.insert(candidate, contentHash);
    const found = repo.findById(candidate.id);
    expect(found?.metadata.filePaths).toEqual(['src/api.ts', 'src/auth.ts']);
    expect(found?.metadata.language).toBe('typescript');
    expect(found?.prePolicyFlags.potentialSecret).toBe(true);
    expect(found?.prePolicyFlags.duplicateSuspect).toBe(true);
  });

  it('multiple inserts produce a correct count', () => {
    for (let i = 0; i < 5; i++) {
      const { candidate, contentHash } = makeCandidate({ content: `content-${i.toString()}` });
      repo.insert(candidate, contentHash);
    }
    expect(repo.count()).toBe(5);
  });

  it('handles special characters in content without corruption', () => {
    const specialContent = `Use "double-quotes", 'single-quotes', <tags>, & ampersands\nnewlines\ttabs`;
    const { candidate, contentHash } = makeCandidate({ content: specialContent });
    repo.insert(candidate, contentHash);
    const found = repo.findById(candidate.id);
    expect(found?.content).toBe(specialContent);
    expect(found && computeContentHash(found.content)).toBe(contentHash);
  });
});
