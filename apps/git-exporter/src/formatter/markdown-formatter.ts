import type { CuratedMemory } from '@qmd-team-intent-kb/schema';
import { extractFrontmatter, renderFrontmatter } from './frontmatter.js';

/** Optional callback to resolve wiki-links in content before export */
export type LinkResolver = (content: string) => string;

/**
 * Format a CuratedMemory as a full Markdown document with YAML frontmatter.
 *
 * When a `resolveLinks` callback is provided, wiki-links in the content
 * are resolved before rendering. Unresolved links pass through as literal
 * `[[slug]]` text.
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
export function formatMemoryAsMarkdown(memory: CuratedMemory, resolveLinks?: LinkResolver): string {
  const frontmatter = renderFrontmatter(extractFrontmatter(memory));
  const content = resolveLinks ? resolveLinks(memory.content) : memory.content;
  return `${frontmatter}\n\n# ${memory.title}\n\n${content}\n`;
}

/**
 * Generate the filename for a memory: `{id}.md`
 */
export function getFilename(memory: CuratedMemory): string {
  return `${memory.id}.md`;
}
