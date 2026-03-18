import type { QmdSearchResult } from '../types.js';

/** Parse qmd query output (which may include scores and metadata) */
export function parseQueryOutput(stdout: string): QmdSearchResult[] {
  const results: QmdSearchResult[] = [];
  const lines = stdout.trim().split('\n').filter(Boolean);

  for (const line of lines) {
    // qmd query output: various formats, try tab-separated first
    const tabParts = line.split('\t');
    if (tabParts.length >= 2) {
      const score = parseFloat(tabParts[0] ?? '0');
      const file = tabParts[1] ?? '';
      const snippet = tabParts.slice(2).join('\t');
      const collection = deriveCollectionFromPath(file);
      results.push({
        file,
        score: isNaN(score) ? 0 : score,
        snippet,
        collection,
      });
    }
  }

  return results;
}

/** Derive collection name from a file path */
export function deriveCollectionFromPath(filePath: string): string {
  const knownCollections = ['kb-curated', 'kb-decisions', 'kb-guides', 'kb-inbox', 'kb-archive'];
  for (const name of knownCollections) {
    if (filePath.includes(name)) return name;
  }
  return 'unknown';
}
