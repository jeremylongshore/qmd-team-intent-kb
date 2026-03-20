#!/usr/bin/env bash
# flush-spool.sh — Stop hook for qmd-team-intent-kb plugin
# Drains the spool directory: curate → export → qmd embed.
# Single-writer: only runs when the session is ending (no daemon conflict).
set -euo pipefail

TEAMKB_DIR="${TEAMKB_BASE_PATH:-$HOME/.teamkb}"
SPOOL_DIR="$TEAMKB_DIR/spool"
DB_PATH="$TEAMKB_DIR/teamkb.db"
EXPORT_DIR="${TEAMKB_EXPORT_DIR:-./kb-export}"

# Exit early if no spool files (use glob to avoid command substitution)
if [ ! -d "$SPOOL_DIR" ]; then
  echo '{"status":"ok","message":"No spool files to process"}'
  exit 0
fi
shopt -s nullglob
SPOOL_FILES=("$SPOOL_DIR"/*)
shopt -u nullglob
if [ ${#SPOOL_FILES[@]} -eq 0 ]; then
  echo '{"status":"ok","message":"No spool files to process"}'
  exit 0
fi

# Determine curator script location
if [ -n "${CLAUDE_PLUGIN_DATA:-}" ]; then
  CURATOR_SCRIPT="$CLAUDE_PLUGIN_DATA/flush.js"
else
  CURATOR_SCRIPT="${CLAUDE_PLUGIN_ROOT:-.}/apps/mcp-server/dist/flush.js"
fi

# Run inline curation if script exists
if [ -f "$CURATOR_SCRIPT" ]; then
  TEAMKB_DB_PATH="$DB_PATH" \
  TEAMKB_SPOOL_DIR="$SPOOL_DIR" \
  TEAMKB_EXPORT_DIR="$EXPORT_DIR" \
  node "$CURATOR_SCRIPT" 2>/dev/null || {
    echo '{"status":"error","message":"Curation failed"}'
    exit 0  # Don't block session exit
  }
fi

# Trigger qmd embed if available
if command -v qmd &>/dev/null && [ -d "$EXPORT_DIR" ]; then
  qmd embed 2>/dev/null || true
fi

echo '{"status":"ok","message":"Spool flushed"}'
