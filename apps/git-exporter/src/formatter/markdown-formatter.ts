import type { CuratedMemory } from '@qmd-team-intent-kb/schema';
import { extractFrontmatter, renderFrontmatter } from './frontmatter.js';

/**
 * Format a CuratedMemory as a full Markdown document with YAML frontmatter.
 *
 * Structure:
 * ```
 * ---
 * <frontmatter>
 * ---
 *
 * # <title>
 *
 * <content>
 * ```
 */
export function formatMemoryAsMarkdown(memory: CuratedMemory): string {
  const frontmatter = renderFrontmatter(extractFrontmatter(memory));
  return `${frontmatter}\n\n# ${memory.title}\n\n${memory.content}\n`;
}

/**
 * Generate the filename for a memory: `{id}.md`
 */
export function getFilename(memory: CuratedMemory): string {
  return `${memory.id}.md`;
}
