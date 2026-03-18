import type { RepoContextProvider, GitContext } from '../types.js';
import { resolveGitContext } from './git-context.js';

/** Default context provider that uses local git resolution */
export class DefaultContextProvider implements RepoContextProvider {
  async resolveGitContext(cwd?: string): Promise<GitContext | null> {
    return resolveGitContext(cwd);
  }
}
