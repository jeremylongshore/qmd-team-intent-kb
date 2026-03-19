import type Database from 'better-sqlite3';
import type { AuditEvent } from '@qmd-team-intent-kb/schema';

/** Raw SQLite row shape for the audit_events table */
interface AuditRow {
  id: string;
  action: string;
  memory_id: string;
  tenant_id: string;
  actor_json: string;
  reason: string | null;
  details_json: string;
  timestamp: string;
}

function rowToEvent(row: AuditRow): AuditEvent {
  return {
    id: row.id,
    action: row.action as AuditEvent['action'],
    memoryId: row.memory_id,
    tenantId: row.tenant_id,
    actor: JSON.parse(row.actor_json) as AuditEvent['actor'],
    reason: row.reason ?? undefined,
    details: JSON.parse(row.details_json) as AuditEvent['details'],
    timestamp: row.timestamp,
  };
}

/**
 * Append-only repository for immutable audit events.
 * No update or delete methods are exposed by design.
 */
export class AuditRepository {
  private readonly stmtInsert: Database.Statement;
  private readonly stmtFindByMemory: Database.Statement;
  private readonly stmtFindByTenant: Database.Statement;
  private readonly stmtFindByAction: Database.Statement;
  private readonly stmtCountByAction: Database.Statement;
  private readonly stmtFindInRange: Database.Statement;
  private readonly stmtCountByTenantAndAction: Database.Statement;

  constructor(db: Database.Database) {
    this.stmtInsert = db.prepare(`
      INSERT INTO audit_events (
        id, action, memory_id, tenant_id, actor_json, reason, details_json, timestamp
      ) VALUES (
        @id, @action, @memory_id, @tenant_id, @actor_json, @reason, @details_json, @timestamp
      )
    `);

    this.stmtFindByMemory = db.prepare(`
      SELECT * FROM audit_events WHERE memory_id = ? ORDER BY timestamp ASC
    `);

    this.stmtFindByTenant = db.prepare(`
      SELECT * FROM audit_events WHERE tenant_id = ? ORDER BY timestamp ASC
    `);

    this.stmtFindByAction = db.prepare(`
      SELECT * FROM audit_events WHERE action = ? ORDER BY timestamp ASC
    `);

    this.stmtCountByAction = db.prepare(`
      SELECT action, COUNT(*) as cnt FROM audit_events GROUP BY action
    `);

    this.stmtFindInRange = db.prepare(`
      SELECT * FROM audit_events WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC
    `);

    this.stmtCountByTenantAndAction = db.prepare(`
      SELECT action, COUNT(*) as cnt FROM audit_events WHERE tenant_id = ? GROUP BY action
    `);
  }

  /** Append a new audit event. This is the only write operation permitted. */
  insert(event: AuditEvent): void {
    this.stmtInsert.run({
      id: event.id,
      action: event.action,
      memory_id: event.memoryId,
      tenant_id: event.tenantId,
      actor_json: JSON.stringify(event.actor),
      reason: event.reason ?? null,
      details_json: JSON.stringify(event.details),
      timestamp: event.timestamp,
    });
  }

  /** Return all events associated with the given memory, in chronological order. */
  findByMemory(memoryId: string): AuditEvent[] {
    const rows = this.stmtFindByMemory.all(memoryId) as AuditRow[];
    return rows.map(rowToEvent);
  }

  /** Return all events for the given tenant, in chronological order. */
  findByTenant(tenantId: string): AuditEvent[] {
    const rows = this.stmtFindByTenant.all(tenantId) as AuditRow[];
    return rows.map(rowToEvent);
  }

  /** Return all events of the given action type, in chronological order. */
  findByAction(action: string): AuditEvent[] {
    const rows = this.stmtFindByAction.all(action) as AuditRow[];
    return rows.map(rowToEvent);
  }

  /** Count events grouped by action type */
  countByAction(): Record<string, number> {
    const rows = this.stmtCountByAction.all() as Array<{ action: string; cnt: number }>;
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.action] = row.cnt;
    }
    return result;
  }

  /** Find events within a time range (ISO string comparison) */
  findInRange(startDate: string, endDate: string): AuditEvent[] {
    const rows = this.stmtFindInRange.all(startDate, endDate) as AuditRow[];
    return rows.map(rowToEvent);
  }

  /** Count events by action for a specific tenant */
  countByTenantAndAction(tenantId: string): Record<string, number> {
    const rows = this.stmtCountByTenantAndAction.all(tenantId) as Array<{
      action: string;
      cnt: number;
    }>;
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.action] = row.cnt;
    }
    return result;
  }
}
