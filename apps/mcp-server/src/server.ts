import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { MemoryCategory, MemoryLifecycleState } from '@qmd-team-intent-kb/schema';
import type { McpServerConfig } from './config.js';
import { propose } from './tools/propose.js';
import { importFiles } from './tools/import.js';
import { getStatus } from './tools/status.js';
import { applyTransition } from './tools/transition.js';
import { runSync, isQmdAvailable } from './tools/sync.js';

const VERSION = '0.1.0';

/**
 * Create a configured McpServer with all team-kb tools registered.
 *
 * Call `isQmdAvailable()` before calling this function if you want to
 * conditionally register the sync tool.
 */
export function createServer(
  config: McpServerConfig,
  options: { withSync?: boolean } = {},
): McpServer {
  const server = new McpServer({ name: 'teamkb', version: VERSION });

  // -------------------------------------------------------------------------
  // teamkb_propose — queue a memory candidate for governance review
  // -------------------------------------------------------------------------
  server.tool(
    'teamkb_propose',
    'Queue a new memory candidate for governance review. Writes to the spool only — the curator promotes it after policy checks pass.',
    {
      title: z.string().min(1).describe('Short descriptive title for the memory'),
      content: z.string().min(1).describe('Full content of the memory'),
      category: MemoryCategory.optional().describe(
        'Memory category: decision, pattern, convention, architecture, troubleshooting, onboarding, reference',
      ),
      filePaths: z
        .array(z.string())
        .optional()
        .describe('Source file paths this memory relates to'),
    },
    async (params) => {
      const result = await propose(
        {
          title: params.title,
          content: params.content,
          category: params.category,
          filePaths: params.filePaths,
        },
        config,
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );

  // -------------------------------------------------------------------------
  // teamkb_import — bulk import files matching a glob pattern
  // -------------------------------------------------------------------------
  server.tool(
    'teamkb_import',
    'Bulk import files matching a glob pattern as memory candidates. Each file becomes one candidate queued for governance review.',
    {
      glob: z.string().min(1).describe('Glob pattern relative to basePath (e.g. "docs/**/*.md")'),
      basePath: z
        .string()
        .optional()
        .describe('Base directory for glob resolution. Defaults to process.cwd()'),
    },
    async (params) => {
      const result = await importFiles({ glob: params.glob, basePath: params.basePath }, config);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );

  // -------------------------------------------------------------------------
  // teamkb_status — read database counts and recent feedback
  // -------------------------------------------------------------------------
  server.tool(
    'teamkb_status',
    'Return memory counts by lifecycle state, category, and tenant, plus recent governance feedback entries.',
    {},
    async () => {
      const result = getStatus(config);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );

  // -------------------------------------------------------------------------
  // teamkb_transition — user-initiated lifecycle transitions
  // -------------------------------------------------------------------------
  server.tool(
    'teamkb_transition',
    'Apply a lifecycle transition to a curated memory. Validates against the state machine and writes an audit event.',
    {
      memoryId: z.string().uuid().describe('UUID of the curated memory to transition'),
      to: MemoryLifecycleState.describe('Target lifecycle state'),
      reason: z.string().min(1).describe('Human-readable reason for the transition'),
      actor: z
        .string()
        .min(1)
        .describe('Identifier of the person or system initiating the transition'),
    },
    async (params) => {
      const result = applyTransition(
        {
          memoryId: params.memoryId,
          to: params.to,
          reason: params.reason,
          actor: params.actor,
        },
        config,
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );

  // -------------------------------------------------------------------------
  // teamkb_sync — rebuild qmd vector index (registered only if qmd is present)
  // -------------------------------------------------------------------------
  if (options.withSync === true) {
    server.tool(
      'teamkb_sync',
      'Rebuild the local qmd vector index by running `qmd embed`. May take up to 2 minutes on large corpora.',
      {},
      async () => {
        const result = await runSync();
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      },
    );
  }

  return server;
}

// Re-export for convenience
export { isQmdAvailable };
