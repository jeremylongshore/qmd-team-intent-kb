import type Database from 'better-sqlite3';
import type { GovernancePolicy } from '@qmd-team-intent-kb/schema';

/** Raw SQLite row shape for the governance_policies table */
interface PolicyRow {
  id: string;
  name: string;
  tenant_id: string;
  rules_json: string;
  enabled: number;
  version: number;
  created_at: string;
  updated_at: string;
}

function rowToPolicy(row: PolicyRow): GovernancePolicy {
  return {
    id: row.id,
    name: row.name,
    tenantId: row.tenant_id,
    rules: JSON.parse(row.rules_json) as GovernancePolicy['rules'],
    enabled: row.enabled !== 0,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Repository for governance policy configurations.
 * All methods use prepared statements. Validation is the caller's responsibility.
 */
export class PolicyRepository {
  private readonly stmtInsert: Database.Statement;
  private readonly stmtFindById: Database.Statement;
  private readonly stmtFindByTenant: Database.Statement;
  private readonly stmtUpdate: Database.Statement;
  private readonly stmtDelete: Database.Statement;

  constructor(db: Database.Database) {
    this.stmtInsert = db.prepare(`
      INSERT INTO governance_policies (
        id, name, tenant_id, rules_json, enabled, version, created_at, updated_at
      ) VALUES (
        @id, @name, @tenant_id, @rules_json, @enabled, @version, @created_at, @updated_at
      )
    `);

    this.stmtFindById = db.prepare(`
      SELECT * FROM governance_policies WHERE id = ?
    `);

    this.stmtFindByTenant = db.prepare(`
      SELECT * FROM governance_policies WHERE tenant_id = ?
    `);

    this.stmtUpdate = db.prepare(`
      UPDATE governance_policies SET
        name = @name,
        tenant_id = @tenant_id,
        rules_json = @rules_json,
        enabled = @enabled,
        version = @version,
        updated_at = @updated_at
      WHERE id = @id
    `);

    this.stmtDelete = db.prepare(`
      DELETE FROM governance_policies WHERE id = ?
    `);
  }

  /** Insert a new governance policy. */
  insert(policy: GovernancePolicy): void {
    this.stmtInsert.run({
      id: policy.id,
      name: policy.name,
      tenant_id: policy.tenantId,
      rules_json: JSON.stringify(policy.rules),
      enabled: policy.enabled ? 1 : 0,
      version: policy.version,
      created_at: policy.createdAt,
      updated_at: policy.updatedAt,
    });
  }

  /** Find a policy by its primary key, or return null if not found. */
  findById(id: string): GovernancePolicy | null {
    const row = this.stmtFindById.get(id) as PolicyRow | undefined;
    return row !== undefined ? rowToPolicy(row) : null;
  }

  /** Return all policies belonging to the given tenant. */
  findByTenant(tenantId: string): GovernancePolicy[] {
    const rows = this.stmtFindByTenant.all(tenantId) as PolicyRow[];
    return rows.map(rowToPolicy);
  }

  /**
   * Perform a full update of an existing policy record.
   * Returns true if a row was modified, false if the id was not found.
   */
  update(policy: GovernancePolicy): boolean {
    const result = this.stmtUpdate.run({
      id: policy.id,
      name: policy.name,
      tenant_id: policy.tenantId,
      rules_json: JSON.stringify(policy.rules),
      enabled: policy.enabled ? 1 : 0,
      version: policy.version,
      updated_at: policy.updatedAt,
    });
    return result.changes > 0;
  }

  /**
   * Delete a policy by id.
   * Returns true if a row was deleted, false if the id was not found.
   */
  delete(id: string): boolean {
    const result = this.stmtDelete.run(id);
    return result.changes > 0;
  }
}
