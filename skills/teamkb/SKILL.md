---
name: teamkb
description: |
  Team knowledge governance for Claude Code. Captures architectural decisions,
  patterns, conventions, and insights during sessions. Shares governed
  knowledge across the team via qmd. Use when making team-relevant
  discoveries or importing existing docs.
allowed-tools: 'Read, Glob, Grep, Bash, Agent'
user-invocable: true
argument-hint: '[capture|import|status|review]'
---

You are assisting with **governed team knowledge management**. This plugin ensures
that team memory is captured, validated through deterministic governance policies,
and shared reliably.

## Available MCP Tools

When the teamkb MCP server is running, you have these tools:

- **teamkb_propose** — Capture a single insight as a memory candidate
  - Input: `{ title, content, category?, filePaths? }`
  - Categories: decision, pattern, convention, architecture, troubleshooting, onboarding, reference
  - Writes to spool (not directly to DB). Governance pipeline decides promotion.

- **teamkb_import** — Bulk import files as memory candidates
  - Input: `{ glob, basePath? }`
  - Each file becomes a separate candidate in the spool.

- **teamkb_status** — Check team knowledge health
  - Shows counts by lifecycle state, category, and recent rejection feedback.

- **teamkb_transition** — Change a memory's lifecycle state
  - Input: `{ memoryId, to, reason, actor }`
  - Valid transitions: active→deprecated, active→superseded, active→archived, deprecated→active, deprecated→archived, superseded→archived

- **teamkb_sync** — Trigger qmd embedding (only if qmd installed)

## When to Capture

Recognize these capturable moments during sessions:

1. **Decisions made** — "Let's use X instead of Y because..." → category: decision
2. **Patterns discovered** — "This pattern works well for..." → category: pattern
3. **Conventions agreed** — "We should always..." → category: convention
4. **Architecture documented** — "The data flows from..." → category: architecture
5. **Bugs solved** — "The root cause was..." → category: troubleshooting
6. **Setup documented** — "To get this running..." → category: onboarding

## Quality Bar

Before proposing, ask: **"Would a new team member benefit from finding this in 30 days?"**

Do NOT propose:

- Session-specific debugging steps (too ephemeral)
- Personal preferences (not team knowledge)
- Content already in CLAUDE.md or README
- Anything containing secrets, tokens, or credentials

## Subagents

- **@teamkb-curator** — End-of-session capture sweep. Reviews what happened and proposes insights.
- **@teamkb-classifier** — Categorizes ambiguous content into a MemoryCategory.
- **@teamkb-conflict-checker** — Compares proposed memory against existing ones for conflicts.

## Usage Examples

```
/teamkb capture
→ Invokes @teamkb-curator to review session and propose memories

/teamkb import docs/**/*.md
→ Bulk imports matching files as memory candidates

/teamkb status
→ Shows team knowledge health dashboard

/teamkb review
→ Reviews recent rejections and suggests improvements
```
