import type { Result } from '@qmd-team-intent-kb/common';
import type { SearchScope } from '@qmd-team-intent-kb/schema';
import type { QmdError, QmdHealthStatus, QmdSearchResult } from './types.js';
import type { QmdExecutor } from './executor/executor.js';
import type { QmdAdapterConfig } from './config.js';
import { RealQmdExecutor } from './executor/real-executor.js';
import { CollectionManager } from './collections/collection-manager.js';
import { SearchClient } from './search/search-client.js';
import { IndexLifecycleManager } from './index-manager/index-lifecycle.js';
import { checkHealth } from './health/health-check.js';
import { getQmdTenantIndexPath } from './config.js';

/** Facade class composing all qmd adapter managers */
export class QmdAdapter {
  readonly executor: QmdExecutor;
  readonly collections: CollectionManager;
  readonly search: SearchClient;
  readonly indexLifecycle: IndexLifecycleManager;
  private readonly dataPath: string;

  constructor(config: QmdAdapterConfig, executor?: QmdExecutor) {
    this.dataPath = getQmdTenantIndexPath(config.tenantId);
    this.executor =
      executor ??
      new RealQmdExecutor({
        binary: config.qmdBinary,
        timeout: config.timeout,
        dataDir: this.dataPath,
      });
    this.collections = new CollectionManager(this.executor, this.dataPath);
    this.search = new SearchClient(this.executor);
    this.indexLifecycle = new IndexLifecycleManager(this.executor);
  }

  /** Run a search with curated-only default scope */
  async query(
    queryText: string,
    scope?: SearchScope,
  ): Promise<Result<QmdSearchResult[], QmdError>> {
    return this.search.search(queryText, scope);
  }

  /** Check health of qmd and index state */
  async health(): Promise<QmdHealthStatus> {
    return checkHealth(this.executor);
  }

  /** Update the index */
  async update(): Promise<Result<void, QmdError>> {
    return this.indexLifecycle.update();
  }

  /** Ensure all known collections are set up */
  async ensureCollections(): Promise<Result<string[], QmdError>> {
    return this.collections.ensureCollections(this.dataPath);
  }
}
