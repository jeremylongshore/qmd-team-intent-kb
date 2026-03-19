import { describe, it, expect } from 'vitest';
import { SECRET_PATTERNS, PII_PATTERNS } from '../secrets/patterns.js';

describe('SECRET_PATTERNS', () => {
  it('has 15 patterns', () => {
    expect(SECRET_PATTERNS).toHaveLength(15);
  });

  it('each pattern has required fields', () => {
    for (const p of SECRET_PATTERNS) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.regex).toBeInstanceOf(RegExp);
      expect(p.description).toBeTruthy();
    }
  });

  it('all pattern IDs are unique', () => {
    const ids = SECRET_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('Azure connection string pattern matches AccountKey=base64string==', () => {
    const azurePattern = SECRET_PATTERNS.find((p) => p.id === 'azure-connection-string');
    expect(azurePattern).toBeDefined();
    expect(azurePattern!.regex.test('AccountKey=dGVzdGtleXZhbHVlaGVyZWZvcnRlc3Rpbmc==')).toBe(true);
  });

  it('PostgreSQL pattern matches postgres://user:pass@host:5432/db', () => {
    const pgPattern = SECRET_PATTERNS.find((p) => p.id === 'postgres-connection-string');
    expect(pgPattern).toBeDefined();
    expect(pgPattern!.regex.test('postgres://user:pass@host:5432/db')).toBe(true);
  });
});

describe('PII_PATTERNS', () => {
  it('includes an email address pattern', () => {
    const emailPattern = PII_PATTERNS.find((p) => p.id === 'email-address');
    expect(emailPattern).toBeDefined();
    expect(emailPattern!.regex.test('alice@example.com')).toBe(true);
  });

  it('includes a US phone number pattern', () => {
    const phonePattern = PII_PATTERNS.find((p) => p.id === 'us-phone');
    expect(phonePattern).toBeDefined();
    expect(phonePattern!.regex.test('(555) 867-5309')).toBe(true);
  });

  it('includes an SSN-like pattern', () => {
    const ssnPattern = PII_PATTERNS.find((p) => p.id === 'ssn-like');
    expect(ssnPattern).toBeDefined();
    expect(ssnPattern!.regex.test('123-45-6789')).toBe(true);
  });
});
