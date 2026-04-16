/**
 * Wiki-link parser for Obsidian-style `[[slug]]` and `[[slug|display]]` syntax.
 *
 * Handles extraction and resolution of wiki-links found in curated memory content.
 * Resolution maps slugs to curated memory IDs so links can be rendered as API URLs.
 */

/** A parsed wiki-link occurrence within a content string */
export interface WikiLink {
  /** The full raw match including brackets, e.g. `[[API Design|API patterns]]` */
  raw: string;
  /** The slug (note title or path) before any pipe, e.g. `API Design` */
  slug: string;
  /** Display text after the pipe, or null when absent */
  displayText: string | null;
  /** Inclusive start index of the raw match in the original content string */
  startIndex: number;
  /** Exclusive end index of the raw match in the original content string */
  endIndex: number;
}

/** Per-link outcome from resolveWikiLinks */
export interface ResolvedLink {
  /** The slug as written in the source content */
  slug: string;
  /** The curated memory ID returned by the resolver, or null when unresolved */
  memoryId: string | null;
  /** True when the resolver returned a non-null match */
  resolved: boolean;
}

/** Return value of resolveWikiLinks */
export interface WikiLinkResolutionResult {
  /** Content with resolved links replaced by Markdown reference syntax */
  resolvedContent: string;
  /** One entry per unique wiki-link found, in order of first appearance */
  links: ResolvedLink[];
}

/**
 * Matches `[[...]]` patterns where the inner content is not another `[[` or `]]`.
 *
 * Group 1 — slug (required): everything before the first `|` (or the whole inner
 *            content when no pipe is present), trimmed by the caller.
 * Group 2 — display text (optional): everything after the first `|`.
 *
 * The pattern intentionally rejects:
 *   - `[[]]`  (empty inner content)
 *   - Nested brackets e.g. `[[[foo]]]` (outer brackets do not match)
 *
 * Code-block avoidance is handled at call sites via stripCodeBlocks().
 */
const WIKILINK_RE = /\[\[([^\[\]|][^\[\]|]*?)(?:\|([^\[\]]*))?\]\]/g;

/**
 * Extract all wiki-links from a content string.
 *
 * Links inside fenced code blocks (``` ``` ```) and inline code spans (`` ` ``)
 * are excluded on a best-effort basis — the underlying content is not modified,
 * only matches that fall outside code regions are returned.
 *
 * @param content - Raw Markdown content to scan
 * @returns Array of WikiLink objects ordered by position
 */
export function extractWikiLinks(content: string): WikiLink[] {
  const codeRanges = findCodeRanges(content);
  const links: WikiLink[] = [];

  WIKILINK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = WIKILINK_RE.exec(content)) !== null) {
    const startIndex = match.index;
    const endIndex = startIndex + match[0].length;

    if (isInsideCodeRange(startIndex, endIndex, codeRanges)) {
      continue;
    }

    const rawSlug = match[1]!;
    const rawDisplay = match[2] ?? null;

    links.push({
      raw: match[0],
      slug: rawSlug.trim(),
      displayText: rawDisplay !== null ? rawDisplay.trim() : null,
      startIndex,
      endIndex,
    });
  }

  return links;
}

/**
 * Resolve wiki-links in content, replacing found links with Markdown anchor syntax.
 *
 * Resolution strategy:
 *   - Calls `resolver(slug)` for each unique slug (case-sensitive).
 *   - **Resolved** (`resolver` returns non-null): replaces every occurrence of
 *     `[[slug]]` / `[[slug|display]]` with `[display text or title](/api/memories/{id})`.
 *   - **Unresolved** (`resolver` returns null): the `[[slug]]` text is left unchanged
 *     as a visual signal that the target has not yet been curated.
 *
 * @param content  - Raw Markdown content to process
 * @param resolver - Function that maps a slug string to a memory record, or null
 * @returns Resolved content string and per-link metadata
 */
export function resolveWikiLinks(
  content: string,
  resolver: (slug: string) => { id: string; title: string } | null,
): WikiLinkResolutionResult {
  const allLinks = extractWikiLinks(content);

  if (allLinks.length === 0) {
    return { resolvedContent: content, links: [] };
  }

  // Build resolution map keyed by slug (one resolver call per unique slug)
  const resolutionCache = new Map<string, { id: string; title: string } | null>();
  for (const link of allLinks) {
    if (!resolutionCache.has(link.slug)) {
      resolutionCache.set(link.slug, resolver(link.slug));
    }
  }

  // Build the links metadata array (first occurrence order, deduplicated by slug)
  const seenSlugs = new Set<string>();
  const links: ResolvedLink[] = [];

  for (const link of allLinks) {
    if (!seenSlugs.has(link.slug)) {
      seenSlugs.add(link.slug);
      const resolved = resolutionCache.get(link.slug) ?? null;
      links.push({
        slug: link.slug,
        memoryId: resolved?.id ?? null,
        resolved: resolved !== null,
      });
    }
  }

  // Apply replacements in reverse order to preserve indices
  let result = content;
  for (let i = allLinks.length - 1; i >= 0; i--) {
    const link = allLinks[i]!;
    const resolved = resolutionCache.get(link.slug) ?? null;

    if (resolved === null) {
      // Leave unresolved links as-is
      continue;
    }

    const displayLabel = link.displayText ?? resolved.title;
    const replacement = `[${displayLabel}](/api/memories/${resolved.id})`;
    result = result.slice(0, link.startIndex) + replacement + result.slice(link.endIndex);
  }

  return { resolvedContent: result, links };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface CodeRange {
  start: number;
  end: number;
}

/**
 * Locate fenced code blocks (``` or ~~~) and inline code spans (`) in content.
 * Returns an array of [start, end) ranges (exclusive end) that should be excluded
 * from wiki-link matching.
 */
function findCodeRanges(content: string): CodeRange[] {
  const ranges: CodeRange[] = [];

  // Fenced code blocks: ``` or ~~~ on their own line
  const fencedRe = /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm;
  let m: RegExpExecArray | null;

  fencedRe.lastIndex = 0;
  while ((m = fencedRe.exec(content)) !== null) {
    ranges.push({ start: m.index, end: m.index + m[0].length });
  }

  // Inline code spans: single backtick pairs (non-greedy, no newlines inside)
  const inlineRe = /`[^`\n]+`/g;
  inlineRe.lastIndex = 0;
  while ((m = inlineRe.exec(content)) !== null) {
    // Only add if not already covered by a fenced range
    if (!isInsideCodeRange(m.index, m.index + m[0].length, ranges)) {
      ranges.push({ start: m.index, end: m.index + m[0].length });
    }
  }

  return ranges;
}

function isInsideCodeRange(start: number, end: number, ranges: CodeRange[]): boolean {
  for (const range of ranges) {
    if (start >= range.start && end <= range.end) {
      return true;
    }
  }
  return false;
}
