import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

export interface Fixture {
  dir: string;
  cleanup: () => void;
}

/** Git environment vars to ensure CI identity is set consistently. */
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
};

function exec(cwd: string, cmd: string): string {
  return execSync(cmd, {
    cwd,
    stdio: 'pipe',
    env: GIT_ENV,
  }).toString('utf8');
}

function makeTmp(prefix: string): Fixture {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Plain repo with one commit, origin remote pointing at a fake URL. */
export function makeRepoWithRemote(): Fixture {
  const fx = makeTmp('repo-resolver-plain-');
  exec(fx.dir, 'git init -q -b main');
  exec(fx.dir, 'git config user.email test@example.com');
  exec(fx.dir, 'git config user.name Test');
  exec(fx.dir, 'git remote add origin https://github.com/acme/widget.git');
  exec(fx.dir, 'git commit -q --allow-empty -m init');
  return fx;
}

/** Plain repo with one commit, no remote configured. */
export function makeRepoNoRemote(): Fixture {
  const fx = makeTmp('repo-resolver-noremote-');
  exec(fx.dir, 'git init -q -b main');
  exec(fx.dir, 'git config user.email test@example.com');
  exec(fx.dir, 'git config user.name Test');
  exec(fx.dir, 'git commit -q --allow-empty -m init');
  return fx;
}

/** Repo with no commits at all. */
export function makeRepoNoCommits(): Fixture {
  const fx = makeTmp('repo-resolver-nocommits-');
  exec(fx.dir, 'git init -q -b main');
  exec(fx.dir, 'git config user.email test@example.com');
  exec(fx.dir, 'git config user.name Test');
  return fx;
}

/** Bare repo. */
export function makeBareRepo(): Fixture {
  const fx = makeTmp('repo-resolver-bare-');
  exec(fx.dir, 'git init -q --bare');
  return fx;
}

/**
 * Repo with HEAD detached at the initial commit. Leaves `branch` unresolvable.
 */
export function makeRepoDetached(): Fixture {
  const fx = makeTmp('repo-resolver-detached-');
  exec(fx.dir, 'git init -q -b main');
  exec(fx.dir, 'git config user.email test@example.com');
  exec(fx.dir, 'git config user.name Test');
  exec(fx.dir, 'git commit -q --allow-empty -m init');
  exec(fx.dir, 'git checkout -q --detach HEAD');
  return fx;
}

/** Directory that is not a git repo at all. */
export function makeNonGitDir(): Fixture {
  return makeTmp('repo-resolver-nongit-');
}

/**
 * Plain git repo whose root is also a pnpm workspace, with a single inner
 * workspace package at packages/inner with name `@scope/inner`.
 */
export function makeRepoWithPnpmWorkspace(): Fixture & { innerDir: string } {
  const fx = makeTmp('repo-resolver-pnpm-');
  exec(fx.dir, 'git init -q -b main');
  exec(fx.dir, 'git config user.email test@example.com');
  exec(fx.dir, 'git config user.name Test');
  exec(fx.dir, 'git commit -q --allow-empty -m init');
  writeFileSync(join(fx.dir, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n');
  writeFileSync(join(fx.dir, 'package.json'), JSON.stringify({ name: 'root' }));
  const innerDir = join(fx.dir, 'packages', 'inner');
  mkdirSync(innerDir, { recursive: true });
  writeFileSync(join(innerDir, 'package.json'), JSON.stringify({ name: '@scope/inner' }));
  return { ...fx, innerDir };
}

/**
 * nx workspace with nx.json at root and a package under packages/foo.
 * Invoking the resolver from inside packages/foo should detect isMonorepo=true.
 */
export function makeNxWorkspace(): Fixture & { innerDir: string } {
  const fx = makeTmp('repo-resolver-nx-');
  exec(fx.dir, 'git init -q -b main');
  exec(fx.dir, 'git config user.email test@example.com');
  exec(fx.dir, 'git config user.name Test');
  exec(fx.dir, 'git commit -q --allow-empty -m init');
  writeFileSync(join(fx.dir, 'nx.json'), JSON.stringify({ version: 2 }));
  writeFileSync(join(fx.dir, 'package.json'), JSON.stringify({ name: 'nx-root' }));
  const innerDir = join(fx.dir, 'packages', 'foo');
  mkdirSync(innerDir, { recursive: true });
  writeFileSync(join(innerDir, 'package.json'), JSON.stringify({ name: '@nx-scope/foo' }));
  return { ...fx, innerDir };
}

/**
 * Primary repo with a linked submodule. Returns the primary repo dir and
 * the path inside the submodule working tree.
 *
 * The submodule itself is a separate git repo cloned from a local bare-style
 * source repo so no network is needed.
 */
export function makeRepoWithSubmodule(): Fixture & { submoduleDir: string } {
  // Build the sub-repo that will be used as the submodule source.
  const subSrc = makeTmp('repo-resolver-sub-src-');
  exec(subSrc.dir, 'git init -q -b main');
  exec(subSrc.dir, 'git config user.email test@example.com');
  exec(subSrc.dir, 'git config user.name Test');
  writeFileSync(join(subSrc.dir, 'README.md'), '# sub\n');
  exec(subSrc.dir, 'git add README.md');
  exec(subSrc.dir, 'git commit -q -m "sub init"');

  // Build the primary repo.
  const fx = makeTmp('repo-resolver-submod-');
  exec(fx.dir, 'git init -q -b main');
  exec(fx.dir, 'git config user.email test@example.com');
  exec(fx.dir, 'git config user.name Test');
  exec(fx.dir, 'git commit -q --allow-empty -m init');

  // Add the submodule (disable prompt; use file:// path).
  exec(fx.dir, `git -c protocol.file.allow=always submodule add -q "${subSrc.dir}" vendor/sub`);
  exec(fx.dir, 'git commit -q -m "add submodule"');

  const submoduleDir = join(fx.dir, 'vendor', 'sub');

  const originalCleanup = fx.cleanup;
  return {
    ...fx,
    submoduleDir,
    cleanup: () => {
      originalCleanup();
      subSrc.cleanup();
    },
  };
}

/**
 * Primary repo with a linked worktree at a second temp directory.
 * Returns the primary repo dir and the linked worktree dir.
 */
export function makeRepoWithWorktree(): Fixture & { worktreeDir: string } {
  const fx = makeTmp('repo-resolver-wt-primary-');
  exec(fx.dir, 'git init -q -b main');
  exec(fx.dir, 'git config user.email test@example.com');
  exec(fx.dir, 'git config user.name Test');
  exec(fx.dir, 'git commit -q --allow-empty -m init');

  // Create the branch that the linked worktree will check out.
  exec(fx.dir, 'git branch wt-branch');

  // The linked worktree must live outside the primary repo directory to
  // avoid git complaining about nesting. Use a sibling tmp dir.
  const wtDir = mkdtempSync(join(tmpdir(), 'repo-resolver-wt-linked-'));
  exec(fx.dir, `git worktree add -q "${wtDir}" wt-branch`);

  const originalCleanup = fx.cleanup;
  return {
    ...fx,
    worktreeDir: wtDir,
    cleanup: () => {
      // Prune the worktree registration before removing the directory so git
      // does not leave dangling metadata.
      try {
        exec(fx.dir, `git worktree remove --force "${wtDir}"`);
      } catch {
        // Best-effort; the directory will be removed below anyway.
      }
      rmSync(wtDir, { recursive: true, force: true });
      originalCleanup();
    },
  };
}
