import type Database from 'better-sqlite3';
import type { LinkType, LinkSource } from '@qmd-team-intent-kb/schema';

/** Domain representation of a memory link */
export interface MemoryLink {
  id: string;
  sourceMemoryId: string;
  targetMemoryId: string;
  linkType: LinkType;
  weight: number;
  createdBy: string;
  source: LinkSource;
  importBatchId: string | null;
  createdAt: string;
}

/** A neighbor node returned by graph traversal */
export interface Neighbor {
  memoryId: string;
  linkType: LinkType;
  weight: number;
  direction: 'outgoing' | 'incoming';
}

/** A node in a graph traversal result */
export interface GraphNode {
  memoryId: string;
  depth: number;
  linkType: LinkType;
  weight: number;
}

/**
 * Repository for memory-to-memory links (knowledge graph edges).
 * Supports CRUD, neighbor queries, and recursive CTE graph traversal.
 */
export class MemoryLinksRepository {
  private readonly stmtInsert: Database.Statement;
  private readonly stmtFindById: Database.Statement;
  private readonly stmtFindBySource: Database.Statement;
  private readonly stmtFindByTarget: Database.Statement;
  private readonly stmtFindByType: Database.Statement;
  private readonly stmtFindByBatch: Database.Statement;
  private readonly stmtDelete: Database.Statement;
  private readonly stmtDeleteByBatch: Database.Statement;
  private readonly stmtNeighbors: Database.Statement;
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;

    this.stmtInsert = db.prepare(`
      INSERT INTO memory_links (
        id, source_memory_id, target_memory_id, link_type,
        weight, created_by, source, import_batch_id, created_at
      ) VALUES (
        @id, @source_memory_id, @target_memory_id, @link_type,
        @weight, @created_by, @source, @import_batch_id, @created_at
      )
    `);

    this.stmtFindById = db.prepare(`
      SELECT * FROM memory_links WHERE id = ?
    `);

    this.stmtFindBySource = db.prepare(`
      SELECT * FROM memory_links WHERE source_memory_id = ? ORDER BY created_at ASC
    `);

    this.stmtFindByTarget = db.prepare(`
      SELECT * FROM memory_links WHERE target_memory_id = ? ORDER BY created_at ASC
    `);

    this.stmtFindByType = db.prepare(`
      SELECT * FROM memory_links WHERE link_type = ? ORDER BY created_at ASC
    `);

    this.stmtFindByBatch = db.prepare(`
      SELECT * FROM memory_links WHERE import_batch_id = ? ORDER BY created_at ASC
    `);

    this.stmtDelete = db.prepare(`
      DELETE FROM memory_links WHERE id = ?
    `);

    this.stmtDeleteByBatch = db.prepare(`
      DELETE FROM memory_links WHERE import_batch_id = ?
    `);

    this.stmtNeighbors = db.prepare(`
      SELECT target_memory_id AS memoryId, link_type AS linkType, weight, 'outgoing' AS direction
        FROM memory_links WHERE source_memory_id = ?
      UNION ALL
      SELECT source_memory_id AS memoryId, link_type AS linkType, weight, 'incoming' AS direction
        FROM memory_links WHERE target_memory_id = ?
      ORDER BY weight DESC
    `);
  }

  /** Insert a new link. Throws on unique constraint violation. */
  insert(link: MemoryLink): void {
    this.stmtInsert.run({
      id: link.id,
      source_memory_id: link.sourceMemoryId,
      target_memory_id: link.targetMemoryId,
      link_type: link.linkType,
      weight: link.weight,
      created_by: link.createdBy,
      source: link.source,
      import_batch_id: link.importBatchId,
      created_at: link.createdAt,
    });
  }

  /** Find a link by its primary key, or return null. */
  findById(id: string): MemoryLink | null {
    const row = this.stmtFindById.get(id) as RawLinkRow | undefined;
    return row !== undefined ? rowToLink(row) : null;
  }

  /** All links originating from a given memory. */
  findBySource(memoryId: string): MemoryLink[] {
    return (this.stmtFindBySource.all(memoryId) as RawLinkRow[]).map(rowToLink);
  }

  /** All links pointing to a given memory. */
  findByTarget(memoryId: string): MemoryLink[] {
    return (this.stmtFindByTarget.all(memoryId) as RawLinkRow[]).map(rowToLink);
  }

  /** All links of a given type. */
  findByType(linkType: LinkType): MemoryLink[] {
    return (this.stmtFindByType.all(linkType) as RawLinkRow[]).map(rowToLink);
  }

  /** All links associated with a given import batch. */
  findByBatch(batchId: string): MemoryLink[] {
    return (this.stmtFindByBatch.all(batchId) as RawLinkRow[]).map(rowToLink);
  }

  /** Delete a link by id. Returns true if a row was removed. */
  delete(id: string): boolean {
    return this.stmtDelete.run(id).changes > 0;
  }

  /** Delete all links associated with an import batch. Returns count deleted. */
  deleteByBatch(batchId: string): number {
    return this.stmtDeleteByBatch.run(batchId).changes;
  }

  /** Get all neighbors (both directions) of a memory. */
  neighbors(memoryId: string): Neighbor[] {
    return this.stmtNeighbors.all(memoryId, memoryId) as Neighbor[];
  }

  /**
   * Recursive CTE graph traversal from a starting memory.
   * Returns all reachable nodes up to the given depth.
   */
  traverse(memoryId: string, maxDepth: number = 2): GraphNode[] {
    const sql = `
      WITH RECURSIVE graph(memoryId, depth, linkType, weight) AS (
        SELECT target_memory_id, 1, link_type, weight
          FROM memory_links WHERE source_memory_id = @start
        UNION ALL
        SELECT ml.target_memory_id, g.depth + 1, ml.link_type, ml.weight
          FROM memory_links ml
          JOIN graph g ON ml.source_memory_id = g.memoryId
          WHERE g.depth < @maxDepth
      )
      SELECT DISTINCT memoryId, MIN(depth) AS depth, linkType, weight
        FROM graph
        WHERE memoryId != @start
        GROUP BY memoryId
        ORDER BY depth ASC, weight DESC
    `;
    return this.db.prepare(sql).all({ start: memoryId, maxDepth }) as GraphNode[];
  }
}

/** Raw row shape from SQLite */
interface RawLinkRow {
  id: string;
  source_memory_id: string;
  target_memory_id: string;
  link_type: string;
  weight: number;
  created_by: string;
  source: string;
  import_batch_id: string | null;
  created_at: string;
}

function rowToLink(row: RawLinkRow): MemoryLink {
  return {
    id: row.id,
    sourceMemoryId: row.source_memory_id,
    targetMemoryId: row.target_memory_id,
    linkType: row.link_type as LinkType,
    weight: row.weight,
    createdBy: row.created_by,
    source: row.source as LinkSource,
    importBatchId: row.import_batch_id,
    createdAt: row.created_at,
  };
}
