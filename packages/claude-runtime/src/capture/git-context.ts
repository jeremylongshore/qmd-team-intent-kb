import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { GitContext } from '../types.js';

const execFileAsync = promisify(execFile);

/** Run a git command and return stdout, or null on failure */
async function git(args: string[], cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd, timeout: 5000 });
    return stdout.trim();
  } catch {
    return null;
  }
}

/** Derive a tenant ID from a git remote URL */
export function deriveTenantId(repoUrl: string): string {
  // Handle SSH: git@github.com:org/repo.git
  const sshMatch = /[:/]([^/]+\/[^/.]+)(?:\.git)?$/.exec(repoUrl);
  if (sshMatch?.[1]) return sshMatch[1].replace('/', '-');

  // Handle HTTPS: https://github.com/org/repo.git
  const httpsMatch = /\/([^/]+\/[^/.]+?)(?:\.git)?$/.exec(repoUrl);
  if (httpsMatch?.[1]) return httpsMatch[1].replace('/', '-');

  return repoUrl;
}

/** Resolve minimal git context for the current working directory */
export async function resolveGitContext(cwd?: string): Promise<GitContext | null> {
  const dir = cwd ?? process.cwd();

  const repoUrl = await git(['config', '--get', 'remote.origin.url'], dir);
  if (!repoUrl) return null;

  const branch = (await git(['rev-parse', '--abbrev-ref', 'HEAD'], dir)) ?? 'unknown';
  const userName = (await git(['config', 'user.name'], dir)) ?? 'unknown';
  const tenantId = deriveTenantId(repoUrl);

  return { repoUrl, branch, userName, tenantId };
}
