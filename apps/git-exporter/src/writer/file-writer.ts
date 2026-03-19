import { writeFileSync, mkdirSync, unlinkSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Write content to a file, creating all parent directories as needed.
 */
export function writeFile(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

/**
 * Archive a memory file by removing it from `fromPath` (if it exists)
 * and writing updated content to `toPath`.
 *
 * If the source file does not exist, writes directly to the destination.
 */
export function archiveFile(fromPath: string, toPath: string, content: string): void {
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
export function removeFile(filePath: string): boolean {
  if (existsSync(filePath)) {
    unlinkSync(filePath);
    return true;
  }
  return false;
}
