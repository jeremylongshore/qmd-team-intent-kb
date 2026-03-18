import type { MemorySource, MemoryCategory, TrustLevel } from '@qmd-team-intent-kb/schema';

/** Raw capture event from a Claude Code session */
export interface RawCaptureEvent {
  content: string;
  title: string;
  source: MemorySource;
  category: MemoryCategory;
  trustLevel?: TrustLevel;
  sessionId?: string;
  filePaths?: string[];
  language?: string;
  projectContext?: string;
}

/** Git context resolved at capture time */
export interface GitContext {
  repoUrl: string;
  branch: string;
  userName: string;
  tenantId: string;
}

/** A named secret detection pattern */
export interface SecretPattern {
  id: string;
  name: string;
  regex: RegExp;
  description: string;
}

/** A match found by the secret scanner */
export interface SecretMatch {
  patternId: string;
  patternName: string;
  line: number;
  column: number;
  matchLength: number;
}

/** Interface for providing repo context — integration seam for Phase 5 repo-resolver */
export interface RepoContextProvider {
  resolveGitContext(cwd?: string): Promise<GitContext | null>;
}
