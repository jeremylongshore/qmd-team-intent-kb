/** Generate a CLAUDE.md guidance block for memory capture */
export function generateClaudeMdBlock(tenantId: string): string {
  return `## Team Memory (qmd-team-intent-kb)

This project uses governed team memory. When you learn something worth sharing with the team:

1. **Propose it as a memory candidate** — the system will evaluate it through governance rules
2. **Never write secrets** — API keys, tokens, and credentials are automatically detected and rejected
3. **Be specific** — decisions, patterns, conventions, and troubleshooting steps are most valuable
4. **Include context** — file paths, project context, and rationale help with retrieval

Tenant: ${tenantId}
Scope: curated memories only (inbox and archive are excluded from default search)
`;
}
