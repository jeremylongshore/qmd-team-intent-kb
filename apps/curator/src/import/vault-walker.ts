import { readdir, readFile } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';

/** Result of walking a vault directory */
export interface VaultFile {
  /** Absolute path to the file */
  absolutePath: string;
  /** Path relative to the vault root */
  relativePath: string;
  /** Raw file content (UTF-8) */
  content: string;
}

/** Directories excluded by default (Obsidian internals, trash, git) */
const DEFAULT_EXCLUDES = new Set(['.obsidian', '.trash', '.git', 'node_modules']);

/** File extensions to include */
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdx']);

/**
 * Recursively walk a directory and collect Markdown files.
 *
 * Excludes `.obsidian/`, `.trash/`, `.git/`, `node_modules/` by default.
 * Only includes files with Markdown extensions (.md, .markdown, .mdx).
 *
 * @param rootPath - Absolute path to the vault/directory root
 * @param excludeDirs - Additional directory names to exclude
 * @returns Array of VaultFile objects with content loaded
 */
export async function walkVault(
  rootPath: string,
  excludeDirs: string[] = [],
): Promise<VaultFile[]> {
  const excludeSet = new Set([...DEFAULT_EXCLUDES, ...excludeDirs]);
  const files: VaultFile[] = [];
  await walkDir(rootPath, rootPath, excludeSet, files);
  return files;
}

async function walkDir(
  currentPath: string,
  rootPath: string,
  excludeSet: Set<string>,
  files: VaultFile[],
): Promise<void> {
  let entries;
  try {
    entries = await readdir(currentPath, { withFileTypes: true });
  } catch {
    return; // skip unreadable directories
  }

  for (const entry of entries) {
    const fullPath = join(currentPath, entry.name);

    if (entry.isDirectory()) {
      if (!excludeSet.has(entry.name)) {
        await walkDir(fullPath, rootPath, excludeSet, files);
      }
      continue;
    }

    if (!entry.isFile()) continue;
    if (!MARKDOWN_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;

    try {
      const content = await readFile(fullPath, 'utf8');
      if (content.trim() === '') continue; // skip empty files

      files.push({
        absolutePath: fullPath,
        relativePath: relative(rootPath, fullPath),
        content,
      });
    } catch {
      // skip unreadable files
    }
  }
}

/**
 * Count Markdown files in a directory without reading content.
 * Useful for preview/dry-run to show scope without loading all files.
 */
export async function countVaultFiles(
  rootPath: string,
  excludeDirs: string[] = [],
): Promise<number> {
  const excludeSet = new Set([...DEFAULT_EXCLUDES, ...excludeDirs]);
  return countDir(rootPath, excludeSet);
}

async function countDir(currentPath: string, excludeSet: Set<string>): Promise<number> {
  let entries;
  try {
    entries = await readdir(currentPath, { withFileTypes: true });
  } catch {
    return 0;
  }

  let count = 0;
  for (const entry of entries) {
    if (entry.isDirectory() && !excludeSet.has(entry.name)) {
      count += await countDir(join(currentPath, entry.name), excludeSet);
    } else if (entry.isFile() && MARKDOWN_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      count++;
    }
  }
  return count;
}
