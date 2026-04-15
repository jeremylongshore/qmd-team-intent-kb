export { RepoContext, ResolverError } from './types.js';
export { resolveRepoContext, type ResolveOptions } from './resolver.js';
export {
  RepoContextCache,
  clearCache,
  getDefaultCache,
  setCacheTtl,
  setDefaultCache,
} from './cache.js';
export { detectMonorepo } from './monorepo.js';
export type { MonorepoInfo } from './monorepo.js';

export const name = '@qmd-team-intent-kb/repo-resolver';
