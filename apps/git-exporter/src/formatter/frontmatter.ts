import type { CuratedMemory } from '@qmd-team-intent-kb/schema';
import type { FrontmatterData } from '../types.js';

/**
 * Extract frontmatter data from a CuratedMemory.
 */
export function extractFrontmatter(memory: CuratedMemory): FrontmatterData {
  return {
    id: memory.id,
    title: memory.title,
    category: memory.category,
    lifecycle: memory.lifecycle,
    trustLevel: memory.trustLevel,
    sensitivity: memory.sensitivity,
    tenantId: memory.tenantId,
    contentHash: memory.contentHash,
    author: `${memory.author.type}:${memory.author.id}`,
    promotedAt: memory.promotedAt,
    updatedAt: memory.updatedAt,
    version: memory.version,
    tags: memory.metadata.tags,
    supersededBy: memory.supersession?.supersededBy,
  };
}

/**
 * Render YAML frontmatter string from FrontmatterData.
 *
 * String-templated (no yaml library), deterministic key order, quoted strings.
 * Output begins and ends with `---` on its own line.
 */
export function renderFrontmatter(data: FrontmatterData): string {
  const lines: string[] = ['---'];

  lines.push(`id: "${data.id}"`);
  lines.push(`title: "${escapeYamlString(data.title)}"`);
  lines.push(`category: "${data.category}"`);
  lines.push(`lifecycle: "${data.lifecycle}"`);
  lines.push(`trust_level: "${data.trustLevel}"`);
  lines.push(`sensitivity: "${data.sensitivity}"`);
  lines.push(`tenant_id: "${data.tenantId}"`);
  lines.push(`content_hash: "${data.contentHash}"`);
  lines.push(`author: "${data.author}"`);
  lines.push(`promoted_at: "${data.promotedAt}"`);
  lines.push(`updated_at: "${data.updatedAt}"`);
  lines.push(`version: ${data.version}`);

  if (data.tags.length > 0) {
    lines.push(`tags:`);
    for (const tag of data.tags) {
      lines.push(`  - "${escapeYamlString(tag)}"`);
    }
  } else {
    lines.push(`tags: []`);
  }

  if (data.supersededBy !== undefined) {
    lines.push(`superseded_by: "${data.supersededBy}"`);
  }

  lines.push('---');
  return lines.join('\n');
}

function escapeYamlString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
