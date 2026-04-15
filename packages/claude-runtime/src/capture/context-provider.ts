import { resolveRepoContext, deriveTenantId } from '@qmd-team-intent-kb/repo-resolver';
import type { RepoContextProvider, GitContext } from '../types.js';
import { resolveGitContext } from './git-context.js';

/** Default context provider that uses repo-resolver with fallback to local git resolution */
export class DefaultContextProvider implements RepoContextProvider {
  async resolveGitContext(cwd?: string): Promise<GitContext | null> {
    const dir = cwd ?? process.cwd();
    const result = await resolveRepoContext(dir);

    if (result.ok) {
      const ctx = result.value;
      const tenantId = deriveTenantId(ctx);
      return {
        repoUrl: ctx.remoteUrl ?? '',
        branch: ctx.branch ?? 'unknown',
        userName: 'unknown',
        tenantId,
        repoName: ctx.repoName,
        commitSha: ctx.commitSha,
      };
    }

    return resolveGitContext(cwd);
  }
}
