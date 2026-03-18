import type { QmdHealthStatus } from '../types.js';
import type { QmdExecutor } from '../executor/executor.js';

/** Check qmd health — never throws, always returns structured status */
export async function checkHealth(executor: QmdExecutor): Promise<QmdHealthStatus> {
  const available = await executor.isAvailable();
  if (!available) {
    return { available: false, version: null, initialized: false, collections: [] };
  }

  // Get version
  let version: string | null = null;
  try {
    const vResult = await executor.execute(['--version']);
    if (vResult.exitCode === 0) {
      version = vResult.stdout.trim();
    }
  } catch {
    // Non-fatal
  }

  // Get collections (proxy for "initialized")
  let collections: string[] = [];
  let initialized = false;
  try {
    const cResult = await executor.execute(['collection', 'list']);
    if (cResult.exitCode === 0) {
      collections = cResult.stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((l) => l.trim());
      initialized = collections.length > 0;
    }
  } catch {
    // Non-fatal
  }

  return { available, version, initialized, collections };
}
