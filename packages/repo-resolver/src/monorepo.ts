import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

const MAX_MANIFEST_SIZE = 64 * 1024;

/**
 * Detection precedence — first match at any directory wins. See
 * 000-docs/026-AT-DSGN-repo-resolver-design.md.
 */
const MANIFEST_PROBES: Array<(dir: string) => boolean> = [
  (dir) => existsSync(join(dir, 'pnpm-workspace.yaml')),
  (dir) => hasNpmWorkspaces(dir),
  (dir) => existsSync(join(dir, 'nx.json')),
  (dir) => existsSync(join(dir, 'turbo.json')),
  (dir) => existsSync(join(dir, 'lerna.json')),
];

interface PackageJson {
  name?: string;
  workspaces?: string[] | { packages?: string[] };
}

function safeReadPackageJson(dir: string): PackageJson | null {
  const path = join(dir, 'package.json');
  if (!existsSync(path)) return null;
  try {
    const stat = statSync(path);
    if (stat.size > MAX_MANIFEST_SIZE) return null;
    return JSON.parse(readFileSync(path, 'utf8')) as PackageJson;
  } catch {
    return null;
  }
}

function hasNpmWorkspaces(dir: string): boolean {
  const pkg = safeReadPackageJson(dir);
  if (!pkg) return false;
  const ws = pkg.workspaces;
  if (Array.isArray(ws) && ws.length > 0) return true;
  if (ws && !Array.isArray(ws) && Array.isArray(ws.packages)) {
    return true;
  }
  return false;
}

export interface MonorepoInfo {
  isMonorepo: boolean;
  workspaceRoot: string | null;
  workspacePackage: string | null;
}

const NEGATIVE: MonorepoInfo = {
  isMonorepo: false,
  workspaceRoot: null,
  workspacePackage: null,
};

/**
 * Detect monorepo workspace context for `cwd` within `repoRoot`.
 *
 * Walks upward from `cwd` to `repoRoot` (inclusive) probing each directory
 * for a workspace manifest. First match wins. When a workspace root is
 * found, the nearest enclosing `package.json` between `cwd` and that root
 * supplies `workspacePackage` — null when cwd is at the workspace root or
 * the package.json has no `name` field.
 */
export function detectMonorepo(cwd: string, repoRoot: string): MonorepoInfo {
  if (!isWithin(cwd, repoRoot)) return NEGATIVE;

  let workspaceRoot: string | null = null;
  let dir = cwd;
  while (true) {
    for (const probe of MANIFEST_PROBES) {
      if (probe(dir)) {
        workspaceRoot = dir;
        break;
      }
    }
    if (workspaceRoot !== null) break;
    if (dir === repoRoot) break;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  if (workspaceRoot === null) return NEGATIVE;

  return {
    isMonorepo: true,
    workspaceRoot,
    workspacePackage: findWorkspacePackage(cwd, workspaceRoot),
  };
}

/**
 * Walk from `cwd` back toward `workspaceRoot` (exclusive) finding the
 * nearest `package.json` with a `name` field. Returns the name string,
 * or null when cwd is at workspaceRoot itself or no named package.json
 * exists between them.
 */
function findWorkspacePackage(cwd: string, workspaceRoot: string): string | null {
  if (cwd === workspaceRoot) return null;

  let dir = cwd;
  while (dir !== workspaceRoot) {
    const pkg = safeReadPackageJson(dir);
    if (pkg?.name && pkg.name.trim().length > 0) {
      return pkg.name.trim();
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * True when `child` equals `ancestor` or sits underneath it. Defends against
 * the `/repo-foo` / `/repo-foo-bar` prefix-match bug.
 */
function isWithin(child: string, ancestor: string): boolean {
  if (child === ancestor) return true;
  const rel = relative(ancestor, child);
  return rel.length > 0 && !rel.startsWith('..') && !rel.startsWith(sep);
}
