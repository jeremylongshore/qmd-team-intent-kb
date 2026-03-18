import { describe, it, expect } from 'vitest';
import { redactSecrets } from '../secrets/redactor.js';

describe('redactSecrets', () => {
  it('redacts AWS keys', () => {
    const content = 'aws_key = AKIAIOSFODNN7EXAMPLE';
    const result = redactSecrets(content);
    expect(result).toContain('[REDACTED:aws-key]');
    expect(result).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });

  it('redacts JWT tokens', () => {
    const content =
      'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const result = redactSecrets(content);
    expect(result).toContain('[REDACTED:jwt]');
  });

  it('redacts connection strings', () => {
    const content = 'postgres://admin:s3cret@localhost:5432/db';
    const result = redactSecrets(content);
    expect(result).toContain('[REDACTED:connection-string]');
  });

  it('leaves clean content unchanged', () => {
    const content = 'Use Result<T, E> for error handling';
    expect(redactSecrets(content)).toBe(content);
  });

  it('handles multiple secrets on different lines', () => {
    const content = 'key=AKIAIOSFODNN7EXAMPLE\ndb=postgres://user:pass@host/db';
    const result = redactSecrets(content);
    expect(result).toContain('[REDACTED:aws-key]');
    expect(result).toContain('[REDACTED:connection-string]');
  });
});
