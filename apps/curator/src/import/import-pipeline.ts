import { randomUUID } from 'node:crypto';
import type { MemoryCandidate, MemoryCategory } from '@qmd-team-intent-kb/schema';
import type {
  CandidateRepository,
  MemoryRepository,
  ImportBatchRepository,
  ImportBatch,
} from '@qmd-team-intent-kb/store';
import { walkVault } from './vault-walker.js';
import { parseMarkdown, titleFromPath } from './markdown-parser.js';
import { detectCollision } from './collision-detector.js';
import type { CollisionResult } from './collision-detector.js';

/** Per-file outcome in an import operation */
export interface ImportFileResult {
  relativePath: string;
  status: 'created' | 'skipped' | 'rejected' | 'error';
  reason?: string;
  candidateId?: string;
  collision?: CollisionResult;
}

/** Aggregate result of an import preview (dry-run) */
export interface ImportPreviewResult {
  sourcePath: string;
  fileCount: number;
  wouldCreate: number;
  wouldSkip: number;
  files: ImportFileResult[];
}

/** Aggregate result of an import execution */
export interface ImportExecutionResult {
  batchId: string;
  sourcePath: string;
  fileCount: number;
  createdCount: number;
  rejectedCount: number;
  skippedCount: number;
  files: ImportFileResult[];
}

/** Dependencies for the import pipeline */
export interface ImportDependencies {
  memoryRepo: MemoryRepository;
  candidateRepo: CandidateRepository;
  batchRepo: ImportBatchRepository;
}

/** Valid memory categories for mapping from frontmatter */
const VALID_CATEGORIES = new Set([
  'decision',
  'pattern',
  'convention',
  'architecture',
  'troubleshooting',
  'onboarding',
  'reference',
]);

/**
 * Preview an import without persisting anything.
 * Walks the vault, checks collisions, and reports what would happen.
 */
export async function previewImport(
  sourcePath: string,
  _tenantId: string,
  deps: ImportDependencies,
  excludeDirs?: string[],
): Promise<ImportPreviewResult> {
  const vaultFiles = await walkVault(sourcePath, excludeDirs);
  const batchHashes = new Set<string>();
  const files: ImportFileResult[] = [];
  let wouldCreate = 0;
  let wouldSkip = 0;

  for (const vf of vaultFiles) {
    const { body } = parseMarkdown(vf.content);

    if (!body.trim()) {
      files.push({ relativePath: vf.relativePath, status: 'skipped', reason: 'Empty body' });
      wouldSkip++;
      continue;
    }

    const collision = detectCollision(body, deps.memoryRepo, deps.candidateRepo, batchHashes);

    if (collision.hasCollision) {
      files.push({
        relativePath: vf.relativePath,
        status: 'skipped',
        reason: `Collision with ${collision.target}: ${collision.matchedTitle ?? collision.matchedId ?? 'unknown'}`,
        collision,
      });
      wouldSkip++;
    } else {
      batchHashes.add(collision.contentHash);
      files.push({ relativePath: vf.relativePath, status: 'created' });
      wouldCreate++;
    }
  }

  return {
    sourcePath,
    fileCount: vaultFiles.length,
    wouldCreate,
    wouldSkip,
    files,
  };
}

/**
 * Execute a full import: walk vault, check collisions, create candidates,
 * track batch. Returns aggregate results.
 */
export async function executeImport(
  sourcePath: string,
  tenantId: string,
  deps: ImportDependencies,
  excludeDirs?: string[],
  nowFn: () => string = () => new Date().toISOString(),
): Promise<ImportExecutionResult> {
  const batchId = randomUUID();
  const now = nowFn();

  // Create batch record
  const batch: ImportBatch = {
    id: batchId,
    tenantId,
    sourcePath,
    fileCount: 0,
    createdCount: 0,
    rejectedCount: 0,
    skippedCount: 0,
    status: 'active',
    createdAt: now,
    rolledBackAt: null,
  };
  deps.batchRepo.insert(batch);

  const vaultFiles = await walkVault(sourcePath, excludeDirs);
  const batchHashes = new Set<string>();
  const files: ImportFileResult[] = [];
  let createdCount = 0;
  let skippedCount = 0;
  let rejectedCount = 0;

  for (const vf of vaultFiles) {
    const parsed = parseMarkdown(vf.content);

    if (!parsed.body.trim()) {
      files.push({ relativePath: vf.relativePath, status: 'skipped', reason: 'Empty body' });
      skippedCount++;
      continue;
    }

    const collision = detectCollision(
      parsed.body,
      deps.memoryRepo,
      deps.candidateRepo,
      batchHashes,
    );

    if (collision.hasCollision) {
      files.push({
        relativePath: vf.relativePath,
        status: 'skipped',
        reason: `Collision: ${collision.matchedTitle ?? collision.matchedId ?? 'duplicate'}`,
        collision,
      });
      skippedCount++;
      continue;
    }

    // Build the candidate
    const candidateId = randomUUID();
    const title =
      typeof parsed.frontmatter['title'] === 'string' && parsed.frontmatter['title']
        ? parsed.frontmatter['title']
        : titleFromPath(vf.relativePath);

    const fmCategory = parsed.frontmatter['category'];
    const category: MemoryCategory =
      typeof fmCategory === 'string' && VALID_CATEGORIES.has(fmCategory)
        ? (fmCategory as MemoryCategory)
        : 'reference';

    const fmTags = parsed.frontmatter['tags'];
    const tags: string[] = Array.isArray(fmTags) ? fmTags.filter((t) => typeof t === 'string') : [];

    const candidate: MemoryCandidate = {
      id: candidateId,
      status: 'inbox',
      source: 'import',
      content: parsed.body,
      title,
      category,
      trustLevel: 'medium',
      author: { type: 'system', id: 'vault-import' },
      tenantId,
      metadata: {
        filePaths: [vf.absolutePath],
        tags,
      },
      prePolicyFlags: {
        potentialSecret: false,
        lowConfidence: false,
        duplicateSuspect: false,
      },
      capturedAt: now,
    };

    try {
      deps.candidateRepo.insert(candidate, collision.contentHash);
      batchHashes.add(collision.contentHash);
      files.push({ relativePath: vf.relativePath, status: 'created', candidateId });
      createdCount++;
    } catch (e) {
      files.push({
        relativePath: vf.relativePath,
        status: 'error',
        reason: e instanceof Error ? e.message : String(e),
      });
      rejectedCount++;
    }
  }

  // Update batch counts and complete
  deps.batchRepo.updateCounts(batchId, {
    fileCount: vaultFiles.length,
    createdCount,
    rejectedCount,
    skippedCount,
  });
  deps.batchRepo.complete(batchId);

  return {
    batchId,
    sourcePath,
    fileCount: vaultFiles.length,
    createdCount,
    rejectedCount,
    skippedCount,
    files,
  };
}
