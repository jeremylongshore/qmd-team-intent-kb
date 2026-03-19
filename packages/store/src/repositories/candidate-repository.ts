import type Database from 'better-sqlite3';
import type { MemoryCandidate } from '@qmd-team-intent-kb/schema';

/** Raw SQLite row shape for the candidates table */
interface CandidateRow {
  id: string;
  status: string;
  source: string;
  content: string;
  title: string;
  category: string;
  trust_level: string;
  author_json: string;
  tenant_id: string;
  metadata_json: string;
  pre_policy_flags_json: string;
  content_hash: string;
  captured_at: string;
  created_at: string;
}

function rowToCandidate(row: CandidateRow): MemoryCandidate {
  return {
    id: row.id,
    status: row.status as MemoryCandidate['status'],
    source: row.source as MemoryCandidate['source'],
    content: row.content,
    title: row.title,
    category: row.category as MemoryCandidate['category'],
    trustLevel: row.trust_level as MemoryCandidate['trustLevel'],
    author: JSON.parse(row.author_json) as MemoryCandidate['author'],
    tenantId: row.tenant_id,
    metadata: JSON.parse(row.metadata_json) as MemoryCandidate['metadata'],
    prePolicyFlags: JSON.parse(row.pre_policy_flags_json) as MemoryCandidate['prePolicyFlags'],
    capturedAt: row.captured_at,
  };
}

/**
 * Repository for raw memory candidate proposals.
 * All methods use prepared statements for safety and performance.
 * Validation is the responsibility of the caller.
 */
export class CandidateRepository {
  private readonly stmtInsert: Database.Statement;
  private readonly stmtFindById: Database.Statement;
  private readonly stmtFindByTenant: Database.Statement;
  private readonly stmtFindByHash: Database.Statement;
  private readonly stmtCount: Database.Statement;
  private readonly stmtCountByTenant: Database.Statement;

  constructor(db: Database.Database) {
    this.stmtInsert = db.prepare(`
      INSERT INTO candidates (
        id, status, source, content, title, category,
        trust_level, author_json, tenant_id,
        metadata_json, pre_policy_flags_json, content_hash, captured_at
      ) VALUES (
        @id, @status, @source, @content, @title, @category,
        @trust_level, @author_json, @tenant_id,
        @metadata_json, @pre_policy_flags_json, @content_hash, @captured_at
      )
    `);

    this.stmtFindById = db.prepare(`
      SELECT * FROM candidates WHERE id = ?
    `);

    this.stmtFindByTenant = db.prepare(`
      SELECT * FROM candidates WHERE tenant_id = ?
    `);

    this.stmtFindByHash = db.prepare(`
      SELECT * FROM candidates WHERE content_hash = ? LIMIT 1
    `);

    this.stmtCount = db.prepare(`
      SELECT COUNT(*) as cnt FROM candidates
    `);

    this.stmtCountByTenant = db.prepare(`
      SELECT tenant_id, COUNT(*) as cnt FROM candidates GROUP BY tenant_id
    `);
  }

  /** Insert a new candidate. The contentHash must be provided by the caller. */
  insert(candidate: MemoryCandidate, contentHash: string): void {
    this.stmtInsert.run({
      id: candidate.id,
      status: candidate.status,
      source: candidate.source,
      content: candidate.content,
      title: candidate.title,
      category: candidate.category,
      trust_level: candidate.trustLevel,
      author_json: JSON.stringify(candidate.author),
      tenant_id: candidate.tenantId,
      metadata_json: JSON.stringify(candidate.metadata),
      pre_policy_flags_json: JSON.stringify(candidate.prePolicyFlags),
      content_hash: contentHash,
      captured_at: candidate.capturedAt,
    });
  }

  /** Find a candidate by its primary key, or return null if not found. */
  findById(id: string): MemoryCandidate | null {
    const row = this.stmtFindById.get(id) as CandidateRow | undefined;
    return row !== undefined ? rowToCandidate(row) : null;
  }

  /** Return all candidates belonging to the given tenant. */
  findByTenant(tenantId: string): MemoryCandidate[] {
    const rows = this.stmtFindByTenant.all(tenantId) as CandidateRow[];
    return rows.map(rowToCandidate);
  }

  /**
   * Return the first candidate with the given content hash, or null.
   * Useful for duplicate detection before insertion.
   */
  findByContentHash(hash: string): MemoryCandidate | null {
    const row = this.stmtFindByHash.get(hash) as CandidateRow | undefined;
    return row !== undefined ? rowToCandidate(row) : null;
  }

  /** Return the total number of candidates in the store. */
  count(): number {
    const result = this.stmtCount.get() as { cnt: number };
    return result.cnt;
  }

  /** Count candidates grouped by tenant */
  countByTenant(): Record<string, number> {
    const rows = this.stmtCountByTenant.all() as Array<{ tenant_id: string; cnt: number }>;
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.tenant_id] = row.cnt;
    }
    return result;
  }
}
