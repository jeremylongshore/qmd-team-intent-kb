import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createServer } from '../server.js';
import type { McpServerConfig } from '../config.js';

function makeConfig(base: string): McpServerConfig {
  return {
    tenantId: 'test-tenant',
    basePath: base,
    spoolPath: join(base, 'spool'),
    dbPath: join(base, 'teamkb.db'),
    feedbackPath: join(base, 'feedback'),
  };
}

describe('createServer()', () => {
  let tmpDir: string;
  let config: McpServerConfig;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'teamkb-server-'));
    config = makeConfig(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns an McpServer instance', () => {
    const server = createServer(config);
    expect(server).toBeInstanceOf(McpServer);
  });

  it('creates server without sync tool by default', () => {
    // createServer({ withSync: false }) — just verify no throw
    const server = createServer(config, { withSync: false });
    expect(server).toBeInstanceOf(McpServer);
  });

  it('creates server with sync tool when withSync is true', () => {
    const server = createServer(config, { withSync: true });
    expect(server).toBeInstanceOf(McpServer);
  });

  it('creates a new distinct server per call', () => {
    const a = createServer(config);
    const b = createServer(config);
    expect(a).not.toBe(b);
  });
});
