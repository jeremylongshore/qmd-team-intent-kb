import type { Result } from '@qmd-team-intent-kb/common';
import type { QmdError } from '../types.js';
import type { QmdExecutor } from '../executor/executor.js';
import { getAllCollectionNames } from './collection-registry.js';

/** Manage qmd collections (add, remove, list) */
export class CollectionManager {
  constructor(
    private readonly executor: QmdExecutor,
    readonly dataPath: string,
  ) {}

  /** Add a collection pointing to a directory */
  async addCollection(name: string, path: string): Promise<Result<void, QmdError>> {
    const result = await this.executor.execute(['collection', 'add', path, '--name', name]);
    if (result.exitCode !== 0) {
      return {
        ok: false,
        error: {
          code: 'command_failed',
          message: `Failed to add collection "${name}"`,
          command: `qmd collection add ${path} --name ${name}`,
          stderr: result.stderr,
        },
      };
    }
    return { ok: true, value: undefined };
  }

  /** Remove a collection */
  async removeCollection(name: string): Promise<Result<void, QmdError>> {
    const result = await this.executor.execute(['collection', 'remove', name]);
    if (result.exitCode !== 0) {
      return {
        ok: false,
        error: {
          code: 'command_failed',
          message: `Failed to remove collection "${name}"`,
          command: `qmd collection remove ${name}`,
          stderr: result.stderr,
        },
      };
    }
    return { ok: true, value: undefined };
  }

  /** List existing collections */
  async listCollections(): Promise<Result<string[], QmdError>> {
    const result = await this.executor.execute(['collection', 'list']);
    if (result.exitCode !== 0) {
      return {
        ok: false,
        error: {
          code: 'command_failed',
          message: 'Failed to list collections',
          command: 'qmd collection list',
          stderr: result.stderr,
        },
      };
    }
    const collections = result.stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => line.trim());
    return { ok: true, value: collections };
  }

  /** Ensure all known collections exist, creating missing ones */
  async ensureCollections(basePath: string): Promise<Result<string[], QmdError>> {
    const listResult = await this.listCollections();
    const existing = listResult.ok ? listResult.value : [];

    const created: string[] = [];
    for (const name of getAllCollectionNames()) {
      if (!existing.some((e) => e.includes(name))) {
        const path = `${basePath}/${name}`;
        const addResult = await this.addCollection(name, path);
        if (!addResult.ok) return { ok: false, error: addResult.error };
        created.push(name);
      }
    }
    return { ok: true, value: created };
  }
}
