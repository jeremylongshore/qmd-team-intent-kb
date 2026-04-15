import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

export interface Fixture {
  dir: string;
  cleanup: () => void;
}

function exec(cwd: string, cmd: string): void {
  execSync(cmd, {
    cwd,
    stdio: 'pipe',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
  });
}

function makeTmp(prefix: string): Fixture {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Plain repo with one commit, origin remote pointing at a fake URL. */
export function makeRepoWithRemote(): Fixture {
  const fx = makeTmp('repo-resolver-plain-');
  exec(fx.dir, 'git init -q -b main');
  exec(fx.dir, 'git remote add origin https://github.com/acme/widget.git');
  exec(fx.dir, 'git commit -q --allow-empty -m init');
  return fx;
}

/** Plain repo with one commit, no remote configured. */
export function makeRepoNoRemote(): Fixture {
  const fx = makeTmp('repo-resolver-noremote-');
  exec(fx.dir, 'git init -q -b main');
  exec(fx.dir, 'git commit -q --allow-empty -m init');
  return fx;
}

/** Repo with no commits at all. */
export function makeRepoNoCommits(): Fixture {
  const fx = makeTmp('repo-resolver-nocommits-');
  exec(fx.dir, 'git init -q -b main');
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
  exec(fx.dir, 'git commit -q --allow-empty -m init');
  writeFileSync(join(fx.dir, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n');
  writeFileSync(join(fx.dir, 'package.json'), JSON.stringify({ name: 'root' }));
  const innerDir = join(fx.dir, 'packages', 'inner');
  mkdirSync(innerDir, { recursive: true });
  writeFileSync(join(innerDir, 'package.json'), JSON.stringify({ name: '@scope/inner' }));
  return { ...fx, innerDir };
}
