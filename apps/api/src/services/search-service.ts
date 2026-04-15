import type { MemoryRepository } from '@qmd-team-intent-kb/store';
import type { SearchQuery, SearchResult, SearchHit } from '@qmd-team-intent-kb/schema';
import { rerankSearchHits } from '@qmd-team-intent-kb/common';
import { badRequest } from '../errors.js';

/**
 * Service layer for memory search with freshness-aware reranking.
 */
export class SearchService {
  constructor(private readonly memoryRepo: MemoryRepository) {}

  /**
   * Search curated memories by text query with freshness reranking.
   *
   * Raw scoring: title match = 0.9, content-only match = 0.6
   * Final score incorporates exponential time decay and category boost.
   */
  search(query: SearchQuery): SearchResult {
    if (query.query.trim().length === 0) {
      throw badRequest('Search query must not be empty');
    }

    const memories = this.memoryRepo.searchByText(query.query, query.tenantId, query.categories);

    const nowIso = new Date().toISOString();
    const queryLower = query.query.toLowerCase();

    const rawHits = memories.map((memory) => {
      const titleMatch = memory.title.toLowerCase().includes(queryLower);
      const rawScore = titleMatch ? 0.9 : 0.6;
      return {
        memoryId: memory.id,
        title: memory.title,
        snippet: memory.content.slice(0, 200),
        score: rawScore,
        category: memory.category,
        updatedAt: memory.updatedAt,
        matchedAt: nowIso,
      };
    });

    const reranked = rerankSearchHits(rawHits, nowIso);

    const page = query.pagination.page;
    const pageSize = query.pagination.pageSize;
    const start = (page - 1) * pageSize;
    const paginatedHits = reranked.slice(start, start + pageSize);

    const hits: SearchHit[] = paginatedHits.map((hit) => ({
      memoryId: hit.memoryId,
      title: hit.title,
      snippet: hit.snippet,
      score: Math.min(hit.finalScore, 1),
      category: hit.category,
      matchedAt: hit.matchedAt,
    }));

    return {
      hits,
      totalCount: reranked.length,
      query: query.query,
      scope: query.scope,
      page,
      pageSize,
      hasMore: start + pageSize < reranked.length,
    };
  }
}
