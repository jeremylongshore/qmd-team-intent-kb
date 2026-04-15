import { readFileSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { RepoContext } from './types.js';

const MAX_CONFIG_SIZE = 64 * 1024;

export interface TenantOverrides {
  /** When set, takes precedence over env, config, remote, and basename. */
  explicit?: string;
  /** Override the env var name (default: TEAMKB_TENANT_ID). */
  envVarName?: string;
  /** Override the env source (default: process.env). For testing. */
  env?: NodeJS.ProcessEnv;
}

/**
 * Strip credentials, protocol, and `.git` from a git remote URL and produce a
 * stable, lowercase identifier.
 *
 * Forms handled:
 *   git@github.com:acme/repo.git              → github.com/acme/repo
 *   https://github.com/acme/repo.git          → github.com/acme/repo
 *   ssh://git@gitlab.com/team/project.git     → gitlab.com/team/project
 *   https://user:token@host/path              → host/path
 *   git+ssh://git@host:1234/path/repo.git     → host:1234/path/repo
 */
export function normalizeRemoteUrl(remoteUrl: string): string {
  let url = remoteUrl.trim();

  // 1. Strip protocol.
  url = url.replace(/^[a-z+]+:\/\//i, '');

  // 2. Strip user-info up to the next `@` (only if no `/` precedes it — guards
  //    against matching `@` inside the path).
  const atIdx = url.indexOf('@');
  const slashIdx = url.indexOf('/');
  if (atIdx !== -1 && (slashIdx === -1 || atIdx < slashIdx)) {
    url = url.slice(atIdx + 1);
  }

  // 3. scp-style `host:path` → `host/path`. Only convert when the part after
  //    `:` doesn't look like a port (digits only).
  const colonIdx = url.indexOf(':');
  if (colonIdx !== -1 && !url.slice(0, colonIdx).includes('/')) {
    const after = url.slice(colonIdx + 1);
    if (!/^\d+(\/|$)/.test(after)) {
      url = url.slice(0, colonIdx) + '/' + after;
    }
  }

  // 4. Strip trailing `.git`.
  url = url.replace(/\.git$/i, '');

  // 5. Lowercase.
  return url.toLowerCase();
}

interface ConfigFile {
  tenantId?: string;
}

function readConfigTenant(rootDir: string): string | null {
  const configPath = join(rootDir, '.teamkb', 'config.json');
  if (!existsSync(configPath)) return null;

  try {
    const raw = readFileSync(configPath, 'utf8');
    if (raw.length > MAX_CONFIG_SIZE) return null;
    const parsed = JSON.parse(raw) as ConfigFile;
    if (typeof parsed.tenantId === 'string' && parsed.tenantId.trim().length > 0) {
      return parsed.tenantId.trim();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Derive a stable tenant identifier for a repo.
 *
 * Precedence (first match wins):
 *   1. `overrides.explicit`
 *   2. Env var (default `TEAMKB_TENANT_ID`)
 *   3. `.teamkb/config.json` `tenantId` field in workspaceRoot ?? repoRoot
 *   4. Normalized origin remote URL
 *   5. lowercase repo basename
 *
 * See 000-docs/026-AT-DSGN-repo-resolver-design.md.
 */
export function deriveTenantId(ctx: RepoContext, overrides: TenantOverrides = {}): string {
  if (overrides.explicit && overrides.explicit.trim().length > 0) {
    return overrides.explicit.trim();
  }

  const env = overrides.env ?? process.env;
  const envVarName = overrides.envVarName ?? 'TEAMKB_TENANT_ID';
  const fromEnv = env[envVarName];
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }

  const configRoot = ctx.workspaceRoot ?? ctx.repoRoot;
  const fromConfig = readConfigTenant(configRoot);
  if (fromConfig) {
    return fromConfig;
  }

  if (ctx.remoteUrl) {
    return normalizeRemoteUrl(ctx.remoteUrl);
  }

  return basename(ctx.repoRoot).toLowerCase();
}
