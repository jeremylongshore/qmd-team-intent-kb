import { z } from 'zod';
import { MemoryCategory, SearchScope } from './enums.js';
import { IsoDatetime, NonEmptyString, TenantId, Uuid } from './common.js';

/** Pagination parameters */
export const Pagination = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export type Pagination = z.infer<typeof Pagination>;

/** A structured search request */
export const SearchQuery = z.object({
  query: NonEmptyString,
  scope: SearchScope,
  tenantId: TenantId.optional(),
  categories: z.array(MemoryCategory).optional(),
  dateFrom: IsoDatetime.optional(),
  dateTo: IsoDatetime.optional(),
  pagination: Pagination.default({ page: 1, pageSize: 20 }),
});
export type SearchQuery = z.infer<typeof SearchQuery>;

/** A single search result hit */
export const SearchHit = z.object({
  memoryId: Uuid,
  title: NonEmptyString,
  snippet: z.string(),
  score: z.number().min(0).max(1),
  category: MemoryCategory,
  highlightedContent: z.string().optional(),
  matchedAt: IsoDatetime,
});
export type SearchHit = z.infer<typeof SearchHit>;

/** Search response with results and pagination metadata */
export const SearchResult = z.object({
  hits: z.array(SearchHit),
  totalCount: z.number().int().min(0),
  query: NonEmptyString,
  scope: SearchScope,
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  hasMore: z.boolean(),
});
export type SearchResult = z.infer<typeof SearchResult>;
