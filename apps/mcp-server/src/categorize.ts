import type { MemoryCategory } from '@qmd-team-intent-kb/schema';

/**
 * Heuristic path-to-category mapping for bulk import.
 *
 * Matches against path segments so 'decisions/adr-001.md' resolves
 * to 'decision' regardless of nesting depth.
 */
const SEGMENT_RULES: Array<{ segments: string[]; category: MemoryCategory }> = [
  { segments: ['decisions', 'adr', 'adrs'], category: 'decision' },
  { segments: ['patterns', 'architecture'], category: 'pattern' },
  { segments: ['conventions', 'standards'], category: 'convention' },
  { segments: ['troubleshooting', 'debug', 'debugging'], category: 'troubleshooting' },
  { segments: ['onboarding', 'setup', 'getting-started'], category: 'onboarding' },
  { segments: ['reference', 'api', 'apis'], category: 'reference' },
];

/**
 * Derive a MemoryCategory from a file path using directory name heuristics.
 *
 * Checks each path segment against the rule table in order. Returns the
 * first match, or 'reference' if no segment matches.
 */
export function categorizeFromPath(filePath: string): MemoryCategory {
  // Normalise: lower-case, split on both / and \ for cross-platform safety
  const segments = filePath.toLowerCase().split(/[/\\]/);

  for (const segment of segments) {
    for (const rule of SEGMENT_RULES) {
      if (rule.segments.includes(segment)) {
        return rule.category;
      }
    }
  }

  return 'reference';
}
