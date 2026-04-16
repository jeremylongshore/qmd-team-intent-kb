import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import {
  createTestDatabase,
  MemoryRepository,
  MemoryLinksRepository,
} from '@qmd-team-intent-kb/store';
import type { MemoryLink } from '@qmd-team-intent-kb/store';
import { buildApp } from '../app.js';
import { makeMemory } from './fixtures.js';

const NOW = '2026-01-15T10:00:00.000Z';

function makeLink(overrides?: Partial<MemoryLink>): MemoryLink {
  return {
    id: randomUUID(),
    sourceMemoryId: 'm1',
    targetMemoryId: 'm2',
    linkType: 'relates_to',
    weight: 1.0,
    createdBy: 'test-user',
    source: 'manual',
    importBatchId: null,
    createdAt: NOW,
    ...overrides,
  };
}

describe('/api/memories/:id/neighbors and /api/memories/:id/graph', () => {
  let db: Database.Database;
  let app: FastifyInstance;
  let memoryRepo: MemoryRepository;
  let linksRepo: MemoryLinksRepository;

  // Stable IDs for graph seeding — avoids UUID generation noise in assertions
  const idA = randomUUID();
  const idB = randomUUID();
  const idC = randomUUID();

  beforeEach(async () => {
    db = createTestDatabase();
    memoryRepo = new MemoryRepository(db);
    linksRepo = new MemoryLinksRepository(db);
    app = buildApp({ db });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  // ---- GET /api/memories/:id/neighbors -------------------------------------

  describe('GET /:id/neighbors', () => {
    it('returns linked memories in both directions', async () => {
      const memA = makeMemory({ id: idA });
      const memB = makeMemory({ id: idB, content: 'Memory B content for graph test' });
      const memC = makeMemory({ id: idC, content: 'Memory C content for graph test' });
      memoryRepo.insert(memA);
      memoryRepo.insert(memB);
      memoryRepo.insert(memC);

      // A → B (outgoing from A)
      linksRepo.insert(makeLink({ sourceMemoryId: idA, targetMemoryId: idB }));
      // C → A (incoming to A)
      linksRepo.insert(
        makeLink({ sourceMemoryId: idC, targetMemoryId: idA, linkType: 'depends_on' }),
      );

      const res = await app.inject({ method: 'GET', url: `/api/memories/${idA}/neighbors` });
      expect(res.statusCode).toBe(200);

      const body = res.json<Array<{ memoryId: string; direction: string; linkType: string }>>();
      expect(body).toHaveLength(2);

      const outgoing = body.find((n) => n.direction === 'outgoing');
      const incoming = body.find((n) => n.direction === 'incoming');

      expect(outgoing?.memoryId).toBe(idB);
      expect(outgoing?.linkType).toBe('relates_to');

      expect(incoming?.memoryId).toBe(idC);
      expect(incoming?.linkType).toBe('depends_on');
    });

    it('returns an empty array for a memory with no links', async () => {
      const mem = makeMemory();
      memoryRepo.insert(mem);

      const res = await app.inject({
        method: 'GET',
        url: `/api/memories/${mem.id}/neighbors`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it('returns 404 for a non-existent memory', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/memories/${randomUUID()}/neighbors`,
      });
      expect(res.statusCode).toBe(404);
      expect(res.json<{ error: string }>().error).toMatch(/not found/i);
    });

    it('includes weight in each neighbor entry', async () => {
      const memA = makeMemory({ id: idA });
      const memB = makeMemory({ id: idB, content: 'Memory B weight test' });
      memoryRepo.insert(memA);
      memoryRepo.insert(memB);

      linksRepo.insert(makeLink({ sourceMemoryId: idA, targetMemoryId: idB, weight: 0.75 }));

      const res = await app.inject({ method: 'GET', url: `/api/memories/${idA}/neighbors` });
      expect(res.statusCode).toBe(200);

      const body = res.json<Array<{ weight: number }>>();
      expect(body[0]?.weight).toBe(0.75);
    });
  });

  // ---- GET /api/memories/:id/graph -----------------------------------------

  describe('GET /:id/graph', () => {
    it('returns nodes at multiple depths', async () => {
      const memA = makeMemory({ id: idA });
      const memB = makeMemory({ id: idB, content: 'Graph depth 1 memory' });
      const memC = makeMemory({ id: idC, content: 'Graph depth 2 memory' });
      memoryRepo.insert(memA);
      memoryRepo.insert(memB);
      memoryRepo.insert(memC);

      // A → B → C (chain depth 2)
      linksRepo.insert(makeLink({ sourceMemoryId: idA, targetMemoryId: idB }));
      linksRepo.insert(
        makeLink({ sourceMemoryId: idB, targetMemoryId: idC, linkType: 'supersedes' }),
      );

      const res = await app.inject({
        method: 'GET',
        url: `/api/memories/${idA}/graph?depth=2`,
      });
      expect(res.statusCode).toBe(200);

      const nodes = res.json<Array<{ memoryId: string; depth: number; linkType: string }>>();
      expect(nodes).toHaveLength(2);

      expect(nodes[0]?.memoryId).toBe(idB);
      expect(nodes[0]?.depth).toBe(1);
      expect(nodes[0]?.linkType).toBe('relates_to');

      expect(nodes[1]?.memoryId).toBe(idC);
      expect(nodes[1]?.depth).toBe(2);
      expect(nodes[1]?.linkType).toBe('supersedes');
    });

    it('respects the depth parameter and stops early', async () => {
      const memA = makeMemory({ id: idA });
      const memB = makeMemory({ id: idB, content: 'Depth limit test B' });
      const memC = makeMemory({ id: idC, content: 'Depth limit test C' });
      memoryRepo.insert(memA);
      memoryRepo.insert(memB);
      memoryRepo.insert(memC);

      linksRepo.insert(makeLink({ sourceMemoryId: idA, targetMemoryId: idB }));
      linksRepo.insert(makeLink({ sourceMemoryId: idB, targetMemoryId: idC }));

      // Request depth=1 — only B should appear
      const res = await app.inject({
        method: 'GET',
        url: `/api/memories/${idA}/graph?depth=1`,
      });
      expect(res.statusCode).toBe(200);

      const nodes = res.json<Array<{ memoryId: string; depth: number }>>();
      expect(nodes).toHaveLength(1);
      expect(nodes[0]?.memoryId).toBe(idB);
      expect(nodes[0]?.depth).toBe(1);
    });

    it('uses default depth of 2 when depth param is omitted', async () => {
      const memA = makeMemory({ id: idA });
      const memB = makeMemory({ id: idB, content: 'Default depth B' });
      const memC = makeMemory({ id: idC, content: 'Default depth C' });
      memoryRepo.insert(memA);
      memoryRepo.insert(memB);
      memoryRepo.insert(memC);

      linksRepo.insert(makeLink({ sourceMemoryId: idA, targetMemoryId: idB }));
      linksRepo.insert(makeLink({ sourceMemoryId: idB, targetMemoryId: idC }));

      // No depth param — default is 2, so both B and C appear
      const res = await app.inject({ method: 'GET', url: `/api/memories/${idA}/graph` });
      expect(res.statusCode).toBe(200);

      const nodes = res.json<Array<{ memoryId: string }>>();
      expect(nodes).toHaveLength(2);
    });

    it('rejects depth greater than 5 with 400', async () => {
      const mem = makeMemory();
      memoryRepo.insert(mem);

      const res = await app.inject({
        method: 'GET',
        url: `/api/memories/${mem.id}/graph?depth=6`,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json<{ error: string }>().error).toMatch(/maximum/i);
    });

    it('caps traversal exactly at depth 5', async () => {
      // Build a chain: A → B → C at depth 2; depth=5 should return both nodes
      const memA = makeMemory({ id: idA });
      const memB = makeMemory({ id: idB, content: 'Cap test B' });
      const memC = makeMemory({ id: idC, content: 'Cap test C' });
      memoryRepo.insert(memA);
      memoryRepo.insert(memB);
      memoryRepo.insert(memC);

      linksRepo.insert(makeLink({ sourceMemoryId: idA, targetMemoryId: idB }));
      linksRepo.insert(makeLink({ sourceMemoryId: idB, targetMemoryId: idC }));

      const res = await app.inject({
        method: 'GET',
        url: `/api/memories/${idA}/graph?depth=5`,
      });
      expect(res.statusCode).toBe(200);

      const nodes = res.json<Array<{ memoryId: string }>>();
      // Chain is only 2 deep; depth=5 doesn't error, just returns what exists
      expect(nodes).toHaveLength(2);
    });

    it('returns 404 for a non-existent memory', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/memories/${randomUUID()}/graph`,
      });
      expect(res.statusCode).toBe(404);
      expect(res.json<{ error: string }>().error).toMatch(/not found/i);
    });

    it('returns 400 for a non-numeric depth value', async () => {
      const mem = makeMemory();
      memoryRepo.insert(mem);

      const res = await app.inject({
        method: 'GET',
        url: `/api/memories/${mem.id}/graph?depth=banana`,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json<{ error: string }>().error).toMatch(/positive integer/i);
    });

    it('returns an empty array for an isolated memory', async () => {
      const mem = makeMemory();
      memoryRepo.insert(mem);

      const res = await app.inject({ method: 'GET', url: `/api/memories/${mem.id}/graph` });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });
  });
});
