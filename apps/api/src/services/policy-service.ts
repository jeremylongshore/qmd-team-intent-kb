import type { PolicyRepository } from '@qmd-team-intent-kb/store';
import { GovernancePolicy } from '@qmd-team-intent-kb/schema';
import { badRequest, notFound } from '../errors.js';

/**
 * Service layer for governance policy CRUD.
 * All inputs are validated with Zod before reaching the repository.
 */
export class PolicyService {
  constructor(private readonly repo: PolicyRepository) {}

  /**
   * Validate and create a new governance policy.
   * Throws 400 on invalid input.
   */
  create(data: unknown): GovernancePolicy {
    const parsed = GovernancePolicy.safeParse(data);
    if (!parsed.success) {
      throw badRequest(`Invalid policy: ${parsed.error.message}`);
    }
    this.repo.insert(parsed.data);
    return parsed.data;
  }

  /**
   * Retrieve a governance policy by its UUID.
   * Throws 404 if not found.
   */
  getById(id: string): GovernancePolicy {
    const policy = this.repo.findById(id);
    if (policy === null) throw notFound(`Policy ${id} not found`);
    return policy;
  }

  /**
   * List governance policies for a tenant.
   * tenantId is required; throws 400 if omitted.
   */
  list(tenantId: string | undefined): GovernancePolicy[] {
    if (tenantId !== undefined && tenantId.length > 0) {
      return this.repo.findByTenant(tenantId);
    }
    throw badRequest('tenantId query parameter is required');
  }

  /**
   * Full-replace update of an existing policy.
   * The body must pass Zod validation and the id must exist.
   * Throws 400 on invalid input or 404 if the policy does not exist.
   */
  update(id: string, data: unknown): GovernancePolicy {
    const parsed = GovernancePolicy.safeParse(data);
    if (!parsed.success) {
      throw badRequest(`Invalid policy update: ${parsed.error.message}`);
    }
    // Ensure the record exists first
    this.getById(id);
    // Enforce URL id wins over body id
    const updated: GovernancePolicy = { ...parsed.data, id };
    const changed = this.repo.update(updated);
    if (!changed) throw notFound(`Policy ${id} not found`);
    return updated;
  }

  /**
   * Delete a policy by its UUID.
   * Throws 404 if not found.
   */
  delete(id: string): void {
    const deleted = this.repo.delete(id);
    if (!deleted) throw notFound(`Policy ${id} not found`);
  }
}
