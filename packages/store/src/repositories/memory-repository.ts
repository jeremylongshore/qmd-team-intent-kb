import type Database from 'better-sqlite3';
import type { CuratedMemory, MemoryLifecycleState } from '@qmd-team-intent-kb/schema';

/** Raw SQLite row shape for the curated_memories table */
interface MemoryRow {
  id: string;
  candidate_id: string;
  source: string;
  content: string;
  title: string;
  category: string;
  trust_level: string;
  sensitivity: string;
  author_json: string;
  tenant_id: string;
  metadata_json: string;
  lifecycle: string;
  content_hash: string;
  policy_evaluations_json: string;
  supersession_json: string | null;
  promoted_at: string;
  promoted_by_json: string;
  updated_at: string;
  version: number;
}

function rowToMemory(row: MemoryRow): CuratedMemory {
  const base = {
    id: row.id,
    candidateId: row.candidate_id,
    source: row.source as CuratedMemory['source'],
    content: row.content,
    title: row.title,
    category: row.category as CuratedMemory['category'],
    trustLevel: row.trust_level as CuratedMemory['trustLevel'],
    sensitivity: row.sensitivity as CuratedMemory['sensitivity'],
    author: JSON.parse(row.author_json) as CuratedMemory['author'],
    tenantId: row.tenant_id,
    metadata: JSON.parse(row.metadata_json) as CuratedMemory['metadata'],
    lifecycle: row.lifecycle as CuratedMemory['lifecycle'],
    contentHash: row.content_hash,
    policyEvaluations: JSON.parse(
      row.policy_evaluations_json,
    ) as CuratedMemory['policyEvaluations'],
    supersession:
      row.supersession_json !== null
        ? (JSON.parse(row.supersession_json) as CuratedMemory['supersession'])
        : undefined,
    promotedAt: row.promoted_at,
    promotedBy: JSON.parse(row.promoted_by_json) as CuratedMemory['promotedBy'],
    updatedAt: row.updated_at,
    version: row.version,
  };

  return base as CuratedMemory;
}

/**
 * Repository for governance-approved curated memories.
 * All methods use prepared statements. Validation is the caller's responsibility.
 */
export class MemoryRepository {
  private readonly stmtInsert: Database.Statement;
  private readonly stmtFindById: Database.Statement;
  private readonly stmtFindByTenant: Database.Statement;
  private readonly stmtFindByHash: Database.Statement;
  private readonly stmtFindByLifecycle: Database.Statement;
  private readonly stmtUpdateLifecycle: Database.Statement;
  private readonly stmtUpdate: Database.Statement;
  private readonly stmtCount: Database.Statement;
  private readonly stmtAllHashes: Database.Statement;

  constructor(db: Database.Database) {
    this.stmtInsert = db.prepare(`
      INSERT INTO curated_memories (
        id, candidate_id, source, content, title, category,
        trust_level, sensitivity, author_json, tenant_id,
        metadata_json, lifecycle, content_hash,
        policy_evaluations_json, supersession_json,
        promoted_at, promoted_by_json, updated_at, version
      ) VALUES (
        @id, @candidate_id, @source, @content, @title, @category,
        @trust_level, @sensitivity, @author_json, @tenant_id,
        @metadata_json, @lifecycle, @content_hash,
        @policy_evaluations_json, @supersession_json,
        @promoted_at, @promoted_by_json, @updated_at, @version
      )
    `);

    this.stmtFindById = db.prepare(`
      SELECT * FROM curated_memories WHERE id = ?
    `);

    this.stmtFindByTenant = db.prepare(`
      SELECT * FROM curated_memories WHERE tenant_id = ?
    `);

    this.stmtFindByHash = db.prepare(`
      SELECT * FROM curated_memories WHERE content_hash = ? LIMIT 1
    `);

    this.stmtFindByLifecycle = db.prepare(`
      SELECT * FROM curated_memories WHERE lifecycle = ?
    `);

    this.stmtUpdateLifecycle = db.prepare(`
      UPDATE curated_memories SET lifecycle = @lifecycle, updated_at = @updated_at WHERE id = @id
    `);

    this.stmtUpdate = db.prepare(`
      UPDATE curated_memories SET
        candidate_id = @candidate_id,
        source = @source,
        content = @content,
        title = @title,
        category = @category,
        trust_level = @trust_level,
        sensitivity = @sensitivity,
        author_json = @author_json,
        tenant_id = @tenant_id,
        metadata_json = @metadata_json,
        lifecycle = @lifecycle,
        content_hash = @content_hash,
        policy_evaluations_json = @policy_evaluations_json,
        supersession_json = @supersession_json,
        promoted_at = @promoted_at,
        promoted_by_json = @promoted_by_json,
        updated_at = @updated_at,
        version = @version
      WHERE id = @id
    `);

    this.stmtCount = db.prepare(`
      SELECT COUNT(*) as cnt FROM curated_memories
    `);

    this.stmtAllHashes = db.prepare(`
      SELECT content_hash FROM curated_memories
    `);
  }

  /** Insert a new curated memory. */
  insert(memory: CuratedMemory): void {
    this.stmtInsert.run({
      id: memory.id,
      candidate_id: memory.candidateId,
      source: memory.source,
      content: memory.content,
      title: memory.title,
      category: memory.category,
      trust_level: memory.trustLevel,
      sensitivity: memory.sensitivity,
      author_json: JSON.stringify(memory.author),
      tenant_id: memory.tenantId,
      metadata_json: JSON.stringify(memory.metadata),
      lifecycle: memory.lifecycle,
      content_hash: memory.contentHash,
      policy_evaluations_json: JSON.stringify(memory.policyEvaluations),
      supersession_json:
        memory.supersession !== undefined ? JSON.stringify(memory.supersession) : null,
      promoted_at: memory.promotedAt,
      promoted_by_json: JSON.stringify(memory.promotedBy),
      updated_at: memory.updatedAt,
      version: memory.version,
    });
  }

  /** Find a memory by its primary key, or return null if not found. */
  findById(id: string): CuratedMemory | null {
    const row = this.stmtFindById.get(id) as MemoryRow | undefined;
    return row !== undefined ? rowToMemory(row) : null;
  }

  /** Return all curated memories belonging to the given tenant. */
  findByTenant(tenantId: string): CuratedMemory[] {
    const rows = this.stmtFindByTenant.all(tenantId) as MemoryRow[];
    return rows.map(rowToMemory);
  }

  /**
   * Return the first memory with the given content hash, or null.
   * Useful for duplicate detection before promotion.
   */
  findByContentHash(hash: string): CuratedMemory | null {
    const row = this.stmtFindByHash.get(hash) as MemoryRow | undefined;
    return row !== undefined ? rowToMemory(row) : null;
  }

  /** Return all memories in the given lifecycle state. */
  findByLifecycle(lifecycle: MemoryLifecycleState): CuratedMemory[] {
    const rows = this.stmtFindByLifecycle.all(lifecycle) as MemoryRow[];
    return rows.map(rowToMemory);
  }

  /**
   * Update only the lifecycle state and updatedAt timestamp.
   * Returns true if a row was modified, false if the id was not found.
   */
  updateLifecycle(id: string, lifecycle: MemoryLifecycleState, updatedAt: string): boolean {
    const result = this.stmtUpdateLifecycle.run({ id, lifecycle, updated_at: updatedAt });
    return result.changes > 0;
  }

  /**
   * Perform a full update of a curated memory record.
   * Returns true if a row was modified, false if the id was not found.
   */
  update(memory: CuratedMemory): boolean {
    const result = this.stmtUpdate.run({
      id: memory.id,
      candidate_id: memory.candidateId,
      source: memory.source,
      content: memory.content,
      title: memory.title,
      category: memory.category,
      trust_level: memory.trustLevel,
      sensitivity: memory.sensitivity,
      author_json: JSON.stringify(memory.author),
      tenant_id: memory.tenantId,
      metadata_json: JSON.stringify(memory.metadata),
      lifecycle: memory.lifecycle,
      content_hash: memory.contentHash,
      policy_evaluations_json: JSON.stringify(memory.policyEvaluations),
      supersession_json:
        memory.supersession !== undefined ? JSON.stringify(memory.supersession) : null,
      promoted_at: memory.promotedAt,
      promoted_by_json: JSON.stringify(memory.promotedBy),
      updated_at: memory.updatedAt,
      version: memory.version,
    });
    return result.changes > 0;
  }

  /** Return the total number of curated memories in the store. */
  count(): number {
    const result = this.stmtCount.get() as { cnt: number };
    return result.cnt;
  }

  /** Return all distinct content hashes present in the store. */
  getAllContentHashes(): string[] {
    const rows = this.stmtAllHashes.all() as Array<{ content_hash: string }>;
    return rows.map((r) => r.content_hash);
  }
}
