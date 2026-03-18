import type { Result } from '@qmd-team-intent-kb/common';
import type { SearchScope } from '@qmd-team-intent-kb/schema';
import type { QmdError, QmdSearchResult } from '../types.js';
import type { QmdExecutor } from '../executor/executor.js';
import { getDefaultSearchCollections } from '../collections/collection-registry.js';

/** Search client with curated-only default scope enforcement */
export class SearchClient {
  constructor(private readonly executor: QmdExecutor) {}

  /** Execute a search query, enforcing curated-only scope by default */
  async search(
    query: string,
    scope: SearchScope = 'curated',
  ): Promise<Result<QmdSearchResult[], QmdError>> {
    const collections = this.resolveCollections(scope);

    const args = ['search', query];
    // qmd search doesn't have a --collection flag per se,
    // but we filter results by collection post-query for scope enforcement
    const result = await this.executor.execute(args);

    if (result.exitCode !== 0) {
      return {
        ok: false,
        error: {
          code: 'command_failed',
          message: `Search failed for query "${query}"`,
          command: `qmd search ${query}`,
          stderr: result.stderr,
        },
      };
    }

    const parsed = this.parseSearchResults(result.stdout);
    // Filter to only allowed collections based on scope
    const filtered =
      scope === 'all' ? parsed : parsed.filter((r) => collections.includes(r.collection));

    return { ok: true, value: filtered };
  }

  /** Resolve which collections to include based on scope */
  private resolveCollections(scope: SearchScope): string[] {
    switch (scope) {
      case 'curated':
        return getDefaultSearchCollections();
      case 'inbox':
        return ['kb-inbox'];
      case 'archived':
        return ['kb-archive'];
      case 'all':
        return []; // No filtering
      default:
        return getDefaultSearchCollections();
    }
  }

  /** Parse qmd search output into typed results */
  private parseSearchResults(stdout: string): QmdSearchResult[] {
    const results: QmdSearchResult[] = [];
    const lines = stdout.trim().split('\n').filter(Boolean);

    for (const line of lines) {
      // qmd search output format: score\tfile\tsnippet
      const parts = line.split('\t');
      if (parts.length >= 2) {
        const score = parseFloat(parts[0] ?? '0');
        const file = parts[1] ?? '';
        const snippet = parts.slice(2).join('\t');

        // Derive collection from file path
        const collection = this.deriveCollection(file);

        results.push({ file, score: isNaN(score) ? 0 : score, snippet, collection });
      }
    }

    return results;
  }

  /** Derive collection name from file path */
  private deriveCollection(filePath: string): string {
    for (const name of ['kb-curated', 'kb-decisions', 'kb-guides', 'kb-inbox', 'kb-archive']) {
      if (filePath.includes(name)) return name;
    }
    return 'unknown';
  }
}
