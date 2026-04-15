/** Result of a path safety check */
export interface PathSafetyResult {
  safe: boolean;
  reason?: string;
}

/**
 * Check if a file path is safe for use in the system.
 *
 * Rejects paths that:
 * - Contain `..` (directory traversal)
 * - Contain null bytes
 * - Are absolute paths not under any allowed root
 *
 * @param path - The path to check
 * @param allowedRoots - Optional list of allowed absolute path prefixes
 */
export function isPathSafe(path: string, allowedRoots?: string[]): PathSafetyResult {
  if (path.includes('\0')) {
    return { safe: false, reason: 'Path contains null byte' };
  }

  const segments = path.split(/[/\\]/);
  if (segments.includes('..')) {
    return { safe: false, reason: 'Path contains directory traversal (..)' };
  }

  const isAbsolute = path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path);

  if (isAbsolute) {
    if (allowedRoots === undefined || allowedRoots.length === 0) {
      return { safe: false, reason: 'Absolute path not allowed (no allowed roots configured)' };
    }

    const normalized = path.replace(/\\/g, '/');
    const isUnderAllowedRoot = allowedRoots.some((root) => {
      const normalizedRoot = root.replace(/\\/g, '/');
      return normalized.startsWith(normalizedRoot);
    });

    if (!isUnderAllowedRoot) {
      return { safe: false, reason: 'Absolute path not under any allowed root' };
    }
  }

  return { safe: true };
}
