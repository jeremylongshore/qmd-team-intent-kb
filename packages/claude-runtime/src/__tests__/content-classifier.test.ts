import { describe, it, expect } from 'vitest';
import { classifyContent } from '../secrets/content-classifier.js';

describe('classifyContent', () => {
  it('returns public with no matches for clean content', () => {
    const result = classifyContent('Use dependency injection for all services in the codebase.');
    expect(result.sensitivityLevel).toBe('public');
    expect(result.matchedPatterns).toHaveLength(0);
    expect(result.hasPii).toBe(false);
    expect(result.hasCredentials).toBe(false);
    expect(result.hasInternalPaths).toBe(false);
  });

  it('returns restricted and hasCredentials=true for content with AWS key', () => {
    const result = classifyContent('aws_access_key_id = AKIAIOSFODNN7EXAMPLE');
    expect(result.sensitivityLevel).toBe('restricted');
    expect(result.hasCredentials).toBe(true);
    expect(result.matchedPatterns).toContain('aws-key');
  });

  it('returns confidential and hasPii=true for content with email address', () => {
    const result = classifyContent('Contact the team lead at alice@example.com for onboarding.');
    expect(result.sensitivityLevel).toBe('confidential');
    expect(result.hasPii).toBe(true);
    expect(result.matchedPatterns).toContain('email-address');
  });

  it('returns confidential and hasPii=true for content with SSN pattern', () => {
    const result = classifyContent('Employee SSN on file: 123-45-6789');
    expect(result.sensitivityLevel).toBe('confidential');
    expect(result.hasPii).toBe(true);
    expect(result.matchedPatterns).toContain('ssn-like');
  });

  it('returns confidential and hasPii=true for content with US phone number', () => {
    const result = classifyContent('Call the support line at (555) 867-5309 for assistance.');
    expect(result.sensitivityLevel).toBe('confidential');
    expect(result.hasPii).toBe(true);
    expect(result.matchedPatterns).toContain('us-phone');
  });

  it('returns internal and hasInternalPaths=true for /home/user/ path', () => {
    const result = classifyContent('Config file located at /home/alice/config/settings.json');
    expect(result.sensitivityLevel).toBe('internal');
    expect(result.hasInternalPaths).toBe(true);
    expect(result.matchedPatterns).toContain('internal-path');
  });

  it('returns internal and hasInternalPaths=true for /Users/admin/ path', () => {
    const result = classifyContent('Run the script from /Users/admin/docs/setup.sh');
    expect(result.sensitivityLevel).toBe('internal');
    expect(result.hasInternalPaths).toBe(true);
    expect(result.matchedPatterns).toContain('internal-path');
  });

  it('returns internal and hasInternalPaths=true for Windows C:\\ path', () => {
    const result = classifyContent('Binary is installed at C:\\Program Files\\MyApp\\app.exe');
    expect(result.sensitivityLevel).toBe('internal');
    expect(result.hasInternalPaths).toBe(true);
    expect(result.matchedPatterns).toContain('internal-path');
  });

  it('credentials override PII — both present yields restricted', () => {
    const result = classifyContent(
      'Contact bob@example.com and use key AKIAIOSFODNN7EXAMPLE to authenticate.',
    );
    expect(result.sensitivityLevel).toBe('restricted');
    expect(result.hasCredentials).toBe(true);
    expect(result.hasPii).toBe(true);
  });

  it('PII overrides internal paths — both present yields confidential', () => {
    const result = classifyContent(
      'Alice (alice@example.com) keeps configs at /home/alice/projects/',
    );
    expect(result.sensitivityLevel).toBe('confidential');
    expect(result.hasPii).toBe(true);
    expect(result.hasInternalPaths).toBe(true);
  });
});
