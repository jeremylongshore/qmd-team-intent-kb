import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { deriveTenantId, normalizeRemoteUrl } from '../tenant.js';
import type { RepoContext } from '../types.js';

function ctxFor(repoRoot: string, overrides: Partial<RepoContext> = {}): RepoContext {
  return {
    repoRoot,
    repoName: basename(repoRoot).toLowerCase(),
    remoteUrl: null,
    branch: null,
    commitSha: '0'.repeat(40),
    isMonorepo: false,
    workspaceRoot: null,
    workspacePackage: null,
    ...overrides,
  };
}

describe('normalizeRemoteUrl', () => {
  it('handles https with .git suffix', () => {
    expect(normalizeRemoteUrl('https://github.com/acme/repo.git')).toBe('github.com/acme/repo');
  });

  it('handles scp-style ssh form', () => {
    expect(normalizeRemoteUrl('git@github.com:acme/repo.git')).toBe('github.com/acme/repo');
  });

  it('handles ssh:// with user-info', () => {
    expect(normalizeRemoteUrl('ssh://git@gitlab.com/team/project.git')).toBe(
      'gitlab.com/team/project',
    );
  });

  it('strips embedded credentials in https URLs', () => {
    expect(normalizeRemoteUrl('https://user:secrettoken@host/path')).toBe('host/path');
    expect(normalizeRemoteUrl('https://user:secrettoken@host/path')).not.toContain('secrettoken');
  });

  it('preserves non-default ssh ports', () => {
    expect(normalizeRemoteUrl('ssh://git@host:2222/path/repo.git')).toBe('host:2222/path/repo');
  });

  it('lowercases mixed-case input', () => {
    expect(normalizeRemoteUrl('https://GitHub.com/Acme/Repo.git')).toBe('github.com/acme/repo');
  });

  it('leaves a URL without scheme alone except for normalization', () => {
    expect(normalizeRemoteUrl('github.com/acme/repo.git')).toBe('github.com/acme/repo');
  });

  it('keeps trailing path when no .git suffix is present', () => {
    expect(normalizeRemoteUrl('https://github.com/acme/repo')).toBe('github.com/acme/repo');
  });
});

describe('deriveTenantId precedence', () => {
  const dirs: string[] = [];

  function tmp(): string {
    const d = mkdtempSync(join(tmpdir(), 'tenant-test-'));
    dirs.push(d);
    return d;
  }

  function writeConfig(rootDir: string, tenantId: unknown): void {
    mkdirSync(join(rootDir, '.teamkb'), { recursive: true });
    writeFileSync(join(rootDir, '.teamkb', 'config.json'), JSON.stringify({ tenantId }));
  }

  afterEach(() => {
    while (dirs.length > 0) {
      const d = dirs.pop();
      if (d) rmSync(d, { recursive: true, force: true });
    }
  });

  it('1) explicit override wins over everything', () => {
    const dir = tmp();
    writeConfig(dir, 'from-config');
    const ctx = ctxFor(dir, { remoteUrl: 'https://github.com/acme/repo.git' });
    const id = deriveTenantId(ctx, {
      explicit: 'forced-tenant',
      env: { TEAMKB_TENANT_ID: 'from-env' },
    });
    expect(id).toBe('forced-tenant');
  });

  it('2) env var beats config, remote, and basename', () => {
    const dir = tmp();
    writeConfig(dir, 'from-config');
    const ctx = ctxFor(dir, { remoteUrl: 'https://github.com/acme/repo.git' });
    const id = deriveTenantId(ctx, { env: { TEAMKB_TENANT_ID: 'from-env' } });
    expect(id).toBe('from-env');
  });

  it('2) custom env var name is honored', () => {
    const dir = tmp();
    const ctx = ctxFor(dir);
    const id = deriveTenantId(ctx, {
      envVarName: 'CUSTOM_TENANT',
      env: { CUSTOM_TENANT: 'from-custom-env' },
    });
    expect(id).toBe('from-custom-env');
  });

  it('3) config file beats remote and basename', () => {
    const dir = tmp();
    writeConfig(dir, 'from-config');
    const ctx = ctxFor(dir, { remoteUrl: 'https://github.com/acme/repo.git' });
    const id = deriveTenantId(ctx, { env: {} });
    expect(id).toBe('from-config');
  });

  it('3) config file is read from workspaceRoot when set', () => {
    const ws = tmp();
    const subRepo = mkdtempSync(join(ws, 'inner-'));
    writeConfig(ws, 'from-workspace-config');
    const ctx = ctxFor(subRepo, { workspaceRoot: ws });
    const id = deriveTenantId(ctx, { env: {} });
    expect(id).toBe('from-workspace-config');
  });

  it('3) malformed config falls through to remote URL', () => {
    const dir = tmp();
    mkdirSync(join(dir, '.teamkb'), { recursive: true });
    writeFileSync(join(dir, '.teamkb', 'config.json'), '{not valid json');
    const ctx = ctxFor(dir, { remoteUrl: 'git@github.com:acme/widget.git' });
    const id = deriveTenantId(ctx, { env: {} });
    expect(id).toBe('github.com/acme/widget');
  });

  it('3) config without tenantId field falls through', () => {
    const dir = tmp();
    writeConfig(dir, undefined);
    const ctx = ctxFor(dir, { remoteUrl: 'git@github.com:acme/widget.git' });
    const id = deriveTenantId(ctx, { env: {} });
    expect(id).toBe('github.com/acme/widget');
  });

  it('3) config with non-string tenantId falls through', () => {
    const dir = tmp();
    writeConfig(dir, 12345);
    const ctx = ctxFor(dir, { remoteUrl: 'git@github.com:acme/widget.git' });
    const id = deriveTenantId(ctx, { env: {} });
    expect(id).toBe('github.com/acme/widget');
  });

  it('4) normalized remote URL wins over basename', () => {
    const dir = tmp();
    const ctx = ctxFor(dir, { remoteUrl: 'git@github.com:acme/widget.git' });
    const id = deriveTenantId(ctx, { env: {} });
    expect(id).toBe('github.com/acme/widget');
  });

  it('5) basename fallback when no other signal exists', () => {
    const dir = tmp();
    const ctx = ctxFor(dir);
    const id = deriveTenantId(ctx, { env: {} });
    expect(id).toBe(basename(dir).toLowerCase());
  });

  it('empty explicit override does not block downstream sources', () => {
    const dir = tmp();
    const ctx = ctxFor(dir, { remoteUrl: 'https://github.com/acme/repo.git' });
    const id = deriveTenantId(ctx, { explicit: '   ', env: {} });
    expect(id).toBe('github.com/acme/repo');
  });

  it('empty env var does not block downstream sources', () => {
    const dir = tmp();
    const ctx = ctxFor(dir, { remoteUrl: 'https://github.com/acme/repo.git' });
    const id = deriveTenantId(ctx, { env: { TEAMKB_TENANT_ID: '' } });
    expect(id).toBe('github.com/acme/repo');
  });
});
