import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { createTestDatabase } from '@qmd-team-intent-kb/store';
import { buildApp } from '../app.js';

// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------

describe('rate limiter middleware', () => {
  let db: Database.Database;
  let app: FastifyInstance;

  beforeEach(async () => {
    db = createTestDatabase();
    // Very low limit so tests can trigger 429 quickly
    app = buildApp({ db, silent: true, rateLimitMax: 2, rateLimitWindowMs: 60_000 });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('normal request within limit returns 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
  });

  it('exceeding rate limit returns 429', async () => {
    // First two requests consume the allowance (max: 2)
    await app.inject({ method: 'GET', url: '/api/health' });
    await app.inject({ method: 'GET', url: '/api/health' });
    // Third request exceeds limit
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(429);
  });

  it('same IP is still limited after hitting different endpoints', async () => {
    await app.inject({ method: 'GET', url: '/api/health' });
    await app.inject({ method: 'GET', url: '/api/health' });
    // Different endpoint, same IP — still limited because the counter is per-IP
    const res = await app.inject({ method: 'GET', url: '/api/memories' });
    expect(res.statusCode).toBe(429);
  });
});

// ---------------------------------------------------------------------------
// API key auth
// ---------------------------------------------------------------------------

describe('API key auth middleware', () => {
  let db: Database.Database;

  afterEach(() => {
    db.close();
  });

  it('without apiKey configured, requests succeed without Authorization header', async () => {
    db = createTestDatabase();
    const app = buildApp({ db, silent: true });
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('with apiKey configured, request without Authorization header returns 401', async () => {
    db = createTestDatabase();
    const app = buildApp({ db, silent: true, apiKey: 'secret-test-key' });
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/api/memories' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('with apiKey configured, request with wrong key returns 401', async () => {
    db = createTestDatabase();
    const app = buildApp({ db, silent: true, apiKey: 'secret-test-key' });
    await app.ready();
    const res = await app.inject({
      method: 'GET',
      url: '/api/memories',
      headers: { Authorization: 'Bearer wrong-key' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('with apiKey configured, request with correct Bearer token returns 200', async () => {
    db = createTestDatabase();
    const app = buildApp({ db, silent: true, apiKey: 'secret-test-key' });
    await app.ready();
    const res = await app.inject({
      method: 'GET',
      url: '/api/memories',
      headers: { Authorization: 'Bearer secret-test-key' },
    });
    // 200 (empty list) or any non-401 response proves auth passed
    expect(res.statusCode).not.toBe(401);
    await app.close();
  });
});

// ---------------------------------------------------------------------------
// Input sanitizer
// ---------------------------------------------------------------------------

describe('input sanitizer middleware', () => {
  let db: Database.Database;
  let app: FastifyInstance;

  beforeEach(async () => {
    db = createTestDatabase();
    // Set a small max body size (1024 bytes) so we can easily exceed it
    app = buildApp({ db, silent: true, maxBodySize: 1024 });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('normal-sized request body is accepted', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { 'content-length': '100' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('request with content-length exceeding limit returns 413', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/candidates',
      headers: { 'content-type': 'application/json', 'content-length': '2048' },
      body: '{}',
    });
    expect(res.statusCode).toBe(413);
  });

  it('request without content-length header is accepted', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
  });
});
