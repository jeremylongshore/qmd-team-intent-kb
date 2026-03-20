import { describe, it, expect } from 'vitest';
import { categorizeFromPath } from '../categorize.js';

describe('categorizeFromPath', () => {
  it('maps decisions/ segment to "decision"', () => {
    expect(categorizeFromPath('decisions/adr-001.md')).toBe('decision');
  });

  it('maps adr/ segment to "decision"', () => {
    expect(categorizeFromPath('docs/adr/0001-use-sqlite.md')).toBe('decision');
  });

  it('maps patterns/ segment to "pattern"', () => {
    expect(categorizeFromPath('patterns/repository-pattern.md')).toBe('pattern');
  });

  it('maps architecture/ segment to "pattern"', () => {
    expect(categorizeFromPath('docs/architecture/overview.md')).toBe('pattern');
  });

  it('maps conventions/ segment to "convention"', () => {
    expect(categorizeFromPath('conventions/naming.md')).toBe('convention');
  });

  it('maps standards/ segment to "convention"', () => {
    expect(categorizeFromPath('standards/code-style.md')).toBe('convention');
  });

  it('maps troubleshooting/ segment to "troubleshooting"', () => {
    expect(categorizeFromPath('troubleshooting/connection-errors.md')).toBe('troubleshooting');
  });

  it('maps debug/ segment to "troubleshooting"', () => {
    expect(categorizeFromPath('debug/memory-leak.md')).toBe('troubleshooting');
  });

  it('maps onboarding/ segment to "onboarding"', () => {
    expect(categorizeFromPath('onboarding/new-engineer.md')).toBe('onboarding');
  });

  it('maps setup/ segment to "onboarding"', () => {
    expect(categorizeFromPath('setup/local-dev.md')).toBe('onboarding');
  });

  it('maps getting-started/ segment to "onboarding"', () => {
    expect(categorizeFromPath('docs/getting-started/quickstart.md')).toBe('onboarding');
  });

  it('maps reference/ segment to "reference"', () => {
    expect(categorizeFromPath('reference/api-endpoints.md')).toBe('reference');
  });

  it('maps api/ segment to "reference"', () => {
    expect(categorizeFromPath('api/rest-guide.md')).toBe('reference');
  });

  it('defaults to "reference" for unrecognised paths', () => {
    expect(categorizeFromPath('random/notes.md')).toBe('reference');
    expect(categorizeFromPath('misc/something.txt')).toBe('reference');
    expect(categorizeFromPath('README.md')).toBe('reference');
  });

  it('is case-insensitive — uppercase segment matches', () => {
    expect(categorizeFromPath('Decisions/my-adr.md')).toBe('decision');
    expect(categorizeFromPath('PATTERNS/service-pattern.md')).toBe('pattern');
  });

  it('matches nested paths correctly', () => {
    expect(categorizeFromPath('docs/team/decisions/big-choice.md')).toBe('decision');
    expect(categorizeFromPath('src/lib/troubleshooting/guide.md')).toBe('troubleshooting');
  });

  it('handles Windows-style backslash paths', () => {
    expect(categorizeFromPath('decisions\\adr-001.md')).toBe('decision');
    expect(categorizeFromPath('patterns\\repository.md')).toBe('pattern');
  });
});
