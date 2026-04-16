import type {
  CandidateRepository,
  MemoryRepository,
  ImportBatchRepository,
  MemoryLinksRepository,
} from '@qmd-team-intent-kb/store';
import { previewImport, executeImport, rollbackImport } from '@qmd-team-intent-kb/curator';
import type {
  ImportPreviewResult,
  ImportExecutionResult,
  RollbackResult,
  ImportDependencies,
} from '@qmd-team-intent-kb/curator';
import { badRequest, notFound } from '../errors.js';

export class ImportService {
  private readonly deps: ImportDependencies;
  private readonly linksRepo?: MemoryLinksRepository;

  constructor(
    candidateRepo: CandidateRepository,
    memoryRepo: MemoryRepository,
    batchRepo: ImportBatchRepository,
    linksRepo?: MemoryLinksRepository,
  ) {
    this.deps = { candidateRepo, memoryRepo, batchRepo };
    this.linksRepo = linksRepo;
  }

  async preview(
    sourcePath: string,
    tenantId: string,
    excludeDirs?: string[],
  ): Promise<ImportPreviewResult> {
    if (!sourcePath || !sourcePath.trim()) {
      throw badRequest('sourcePath is required');
    }
    if (!tenantId || !tenantId.trim()) {
      throw badRequest('tenantId is required');
    }
    return previewImport(sourcePath, tenantId, this.deps, excludeDirs);
  }

  async execute(
    sourcePath: string,
    tenantId: string,
    excludeDirs?: string[],
  ): Promise<ImportExecutionResult> {
    if (!sourcePath || !sourcePath.trim()) {
      throw badRequest('sourcePath is required');
    }
    if (!tenantId || !tenantId.trim()) {
      throw badRequest('tenantId is required');
    }
    return executeImport(sourcePath, tenantId, this.deps, excludeDirs);
  }

  listBatches(tenantId?: string) {
    if (tenantId) {
      return this.deps.batchRepo.findByTenant(tenantId);
    }
    // Return all active + completed batches
    return [
      ...this.deps.batchRepo.findByStatus('active'),
      ...this.deps.batchRepo.findByStatus('completed'),
    ];
  }

  getBatch(batchId: string) {
    const batch = this.deps.batchRepo.findById(batchId);
    if (!batch) throw notFound(`Import batch not found: ${batchId}`);
    return batch;
  }

  rollback(batchId: string): RollbackResult {
    try {
      return rollbackImport(batchId, this.deps, this.linksRepo);
    } catch (e) {
      if (e instanceof Error && e.message.includes('not found')) {
        throw notFound(e.message);
      }
      if (e instanceof Error && e.message.includes('already rolled back')) {
        throw badRequest(e.message);
      }
      throw e;
    }
  }
}
