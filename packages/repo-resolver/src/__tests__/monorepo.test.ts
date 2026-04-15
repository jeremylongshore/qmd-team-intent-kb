import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectMonorepo } from '../monorepo.js';

interface Workspace {
  root: string;
  cleanup: () => void;
}

const dirs: string[] = [];

function tmp(prefix: string): string {
  const d = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  dirs.push(d);
  return d;
}

function writeJson(path: string, body: unknown): void {
  writeFileSync(path, JSON.stringify(body, null, 2));
}

function writeFile(path: string, body: string): void {
  writeFileSync(path, body);
}

function makeMonorepo(
  manifest: 'pnpm' | 'npm' | 'nx' | 'turbo' | 'lerna',
  withPackage = true,
): Workspace {
  const root = tmp(`mr-${manifest}-`);
  switch (manifest) {
    case 'pnpm':
      writeFile(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n');
      writeJson(join(root, 'package.json'), { name: 'root' });
      break;
    case 'npm':
      writeJson(join(root, 'package.json'), {
        name: 'root',
        workspaces: ['packages/*'],
      });
      break;
    case 'nx':
      writeJson(join(root, 'nx.json'), {});
      writeJson(join(root, 'package.json'), { name: 'root' });
      break;
    case 'turbo':
      writeJson(join(root, 'turbo.json'), {});
      writeJson(join(root, 'package.json'), { name: 'root' });
      break;
    case 'lerna':
      writeJson(join(root, 'lerna.json'), {});
      writeJson(join(root, 'package.json'), { name: 'root' });
      break;
  }
  if (withPackage) {
    const pkgDir = join(root, 'packages', 'inner');
    mkdirSync(pkgDir, { recursive: true });
    writeJson(join(pkgDir, 'package.json'), { name: '@scope/inner' });
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

afterEach(() => {
  while (dirs.length > 0) {
    const d = dirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

describe('detectMonorepo manifest precedence', () => {
  it.each(['pnpm', 'npm', 'nx', 'turbo', 'lerna'] as const)(
    'detects %s workspace from inner package',
    (kind) => {
      const ws = makeMonorepo(kind);
      const inner = join(ws.root, 'packages', 'inner');
      const info = detectMonorepo(inner, ws.root);
      expect(info.isMonorepo).toBe(true);
      expect(info.workspaceRoot).toBe(ws.root);
      expect(info.workspacePackage).toBe('@scope/inner');
    },
  );

  it('pnpm beats nx when both present in same dir', () => {
    const root = tmp('mr-precedence-');
    writeFile(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n');
    writeJson(join(root, 'nx.json'), {});
    const info = detectMonorepo(root, root);
    expect(info.workspaceRoot).toBe(root);
  });
});

describe('detectMonorepo cwd handling', () => {
  it('returns null workspacePackage when cwd is at the workspace root', () => {
    const ws = makeMonorepo('pnpm', false);
    const info = detectMonorepo(ws.root, ws.root);
    expect(info.isMonorepo).toBe(true);
    expect(info.workspacePackage).toBeNull();
  });

  it('returns null workspacePackage when no package.json exists between cwd and root', () => {
    const ws = makeMonorepo('pnpm', false);
    const inner = join(ws.root, 'packages', 'inner');
    mkdirSync(inner, { recursive: true });
    const info = detectMonorepo(inner, ws.root);
    expect(info.isMonorepo).toBe(true);
    expect(info.workspacePackage).toBeNull();
  });

  it('returns null workspacePackage when nearest package.json has no name', () => {
    const ws = makeMonorepo('pnpm', false);
    const inner = join(ws.root, 'packages', 'unnamed');
    mkdirSync(inner, { recursive: true });
    writeJson(join(inner, 'package.json'), { version: '0.0.0' });
    const info = detectMonorepo(inner, ws.root);
    expect(info.workspacePackage).toBeNull();
  });

  it('walks upward through nested subdirectories to find the manifest', () => {
    const ws = makeMonorepo('pnpm');
    const deep = join(ws.root, 'packages', 'inner', 'src', 'lib', 'utils');
    mkdirSync(deep, { recursive: true });
    const info = detectMonorepo(deep, ws.root);
    expect(info.workspaceRoot).toBe(ws.root);
    expect(info.workspacePackage).toBe('@scope/inner');
  });
});

describe('detectMonorepo negative cases', () => {
  it('returns non-monorepo when no manifest exists', () => {
    const root = tmp('mr-plain-');
    writeJson(join(root, 'package.json'), { name: 'plain' });
    const info = detectMonorepo(root, root);
    expect(info.isMonorepo).toBe(false);
    expect(info.workspaceRoot).toBeNull();
    expect(info.workspacePackage).toBeNull();
  });

  it('treats package.json without workspaces field as non-monorepo', () => {
    const root = tmp('mr-no-workspaces-');
    writeJson(join(root, 'package.json'), { name: 'plain' });
    const info = detectMonorepo(root, root);
    expect(info.isMonorepo).toBe(false);
  });

  it('treats workspaces:[] as non-monorepo', () => {
    const root = tmp('mr-empty-workspaces-');
    writeJson(join(root, 'package.json'), { name: 'plain', workspaces: [] });
    const info = detectMonorepo(root, root);
    expect(info.isMonorepo).toBe(false);
  });

  it('handles object-form workspaces ({packages: []})', () => {
    const root = tmp('mr-obj-workspaces-');
    writeJson(join(root, 'package.json'), {
      name: 'plain',
      workspaces: { packages: ['packages/*'] },
    });
    const info = detectMonorepo(root, root);
    expect(info.isMonorepo).toBe(true);
  });

  it('returns non-monorepo when cwd is outside repoRoot', () => {
    const repo = tmp('mr-outside-');
    const outside = tmp('mr-outside-other-');
    writeFile(join(repo, 'pnpm-workspace.yaml'), 'packages:\n  - "*"\n');
    const info = detectMonorepo(outside, repo);
    expect(info.isMonorepo).toBe(false);
  });

  it('skips malformed package.json without throwing', () => {
    const root = tmp('mr-bad-json-');
    writeFile(join(root, 'package.json'), '{ this is not json');
    const info = detectMonorepo(root, root);
    expect(info.isMonorepo).toBe(false);
  });
});
