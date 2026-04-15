import { writeFileSync, mkdirSync, unlinkSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Validate that a file path is safe for writing.
 *
 * When `allowedRoot` is provided, the resolved path must be under it.
 * Always rejects paths containing `..` segments or null bytes.
 *
 * @param filePath - The path to validate
 * @param allowedRoot - If provided, absolute paths must be under this root
 * @throws Error if the path is unsafe
 */
function assertPathSafe(filePath: string, allowedRoot?: string): void {
  if (filePath.includes('\0')) {
    throw new Error('Unsafe file path: Path contains null byte');
  }
  const segments = filePath.split(/[/\\]/);
  if (segments.includes('..')) {
    throw new Error('Unsafe file path: Path contains directory traversal (..)');
  }

  if (allowedRoot !== undefined) {
    const resolved = resolve(filePath);
    const resolvedRoot = resolve(allowedRoot);
    if (!resolved.startsWith(resolvedRoot + '/') && resolved !== resolvedRoot) {
      throw new Error(`Path traversal rejected: ${filePath} is outside ${allowedRoot}`);
    }
  }
}

/**
 * Write content to a file, creating all parent directories as needed.
 * Path traversal is validated before writing.
 *
 * @param filePath - Must be an absolute path under the export root
 * @param content - The file content to write
 * @param exportRoot - Optional export root for path validation
 */
export function writeFile(filePath: string, content: string, exportRoot?: string): void {
  assertPathSafe(filePath, exportRoot);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

/**
 * Archive a memory file by removing it from `fromPath` (if it exists)
 * and writing updated content to `toPath`.
 *
 * If the source file does not exist, writes directly to the destination.
 * Path traversal is validated for both paths.
 */
export function archiveFile(
  fromPath: string,
  toPath: string,
  content: string,
  exportRoot?: string,
): void {
  assertPathSafe(toPath, exportRoot);
  if (exportRoot !== undefined) {
    assertPathSafe(fromPath, exportRoot);
  }
  mkdirSync(dirname(toPath), { recursive: true });

  if (existsSync(fromPath)) {
    unlinkSync(fromPath);
  }

  writeFileSync(toPath, content, 'utf8');
}

/**
 * Remove a file if it exists.
 *
 * @returns `true` if the file was deleted, `false` if it did not exist.
 */
export function removeFile(filePath: string, exportRoot?: string): boolean {
  if (exportRoot !== undefined) {
    assertPathSafe(filePath, exportRoot);
  }
  if (existsSync(filePath)) {
    unlinkSync(filePath);
    return true;
  }
  return false;
}
