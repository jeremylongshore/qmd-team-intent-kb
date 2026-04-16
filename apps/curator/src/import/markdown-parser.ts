/**
 * Minimal YAML frontmatter parser for Markdown files.
 *
 * No external YAML library — handles simple key:value frontmatter
 * (strings, numbers, booleans, arrays of strings) which covers
 * Obsidian vault files and typical documentation.
 */

/** Parsed result from a Markdown file with optional frontmatter */
export interface ParsedMarkdown {
  frontmatter: Record<string, string | string[] | number | boolean>;
  body: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Parse a Markdown string into frontmatter and body.
 *
 * Handles YAML-like frontmatter delimited by `---` fences.
 * Returns an empty frontmatter object when no frontmatter is present.
 */
export function parseMarkdown(content: string): ParsedMarkdown {
  const match = FRONTMATTER_RE.exec(content);
  if (!match) {
    return { frontmatter: {}, body: content.trim() };
  }

  const rawYaml = match[1]!;
  const body = content.slice(match[0].length).trim();

  return { frontmatter: parseSimpleYaml(rawYaml), body };
}

/**
 * Parse simple YAML key-value pairs.
 * Supports: strings, numbers, booleans, and YAML flow arrays ([a, b, c]).
 * Does NOT support nested objects, multiline strings, or anchors.
 */
function parseSimpleYaml(yaml: string): Record<string, string | string[] | number | boolean> {
  const result: Record<string, string | string[] | number | boolean> = {};

  for (const line of yaml.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const rawValue = trimmed.slice(colonIdx + 1).trim();

    if (key === '') continue;

    result[key] = coerceValue(rawValue);
  }

  return result;
}

function coerceValue(raw: string): string | string[] | number | boolean {
  if (raw === '' || raw === '~' || raw === 'null') return '';

  // Booleans
  if (raw === 'true') return true;
  if (raw === 'false') return false;

  // Flow array: [a, b, c]
  if (raw.startsWith('[') && raw.endsWith(']')) {
    const inner = raw.slice(1, -1);
    return inner
      .split(',')
      .map((s) => unquote(s.trim()))
      .filter((s) => s !== '');
  }

  // Numbers
  const num = Number(raw);
  if (!Number.isNaN(num) && raw !== '') return num;

  // Quoted or bare string
  return unquote(raw);
}

function unquote(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

/**
 * Derive a human-readable title from a file path.
 * Strips extension, replaces hyphens/underscores with spaces, title-cases.
 */
export function titleFromPath(filePath: string): string {
  const name =
    filePath
      .split('/')
      .pop()
      ?.replace(/\.[^.]+$/, '') ?? filePath;
  return name.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
