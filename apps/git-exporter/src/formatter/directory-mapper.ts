import type { CuratedMemory } from '@qmd-team-intent-kb/schema';

/**
 * Resolve the export subdirectory for a memory.
 *
 * Lifecycle takes precedence over category:
 * - `archived` or `superseded` → `archive/`
 *
 * Category mapping (active / deprecated):
 * - `decision`                                → `decisions/`
 * - `pattern`, `convention`, `architecture`  → `curated/`
 * - `troubleshooting`, `reference`, `onboarding` → `guides/`
 * - unknown / fallback                        → `curated/`
 */
export function getDirectory(memory: CuratedMemory): string {
  if (memory.lifecycle === 'archived' || memory.lifecycle === 'superseded') {
    return 'archive';
  }
  return getCategoryDirectory(memory.category);
}

/**
 * Map a category string to its export subdirectory name.
 * Does not consider lifecycle — use {@link getDirectory} for that.
 */
export function getCategoryDirectory(category: string): string {
  switch (category) {
    case 'decision':
      return 'decisions';
    case 'pattern':
    case 'convention':
    case 'architecture':
      return 'curated';
    case 'troubleshooting':
    case 'reference':
    case 'onboarding':
      return 'guides';
    default:
      return 'curated';
  }
}

/**
 * Get the full relative path for a memory file within the export directory.
 * Format: `{directory}/{id}.md`
 */
export function getRelativePath(memory: CuratedMemory): string {
  return `${getDirectory(memory)}/${memory.id}.md`;
}
