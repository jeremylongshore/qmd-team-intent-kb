#!/usr/bin/env bash
# bootstrap.sh — SessionStart hook for qmd-team-intent-kb plugin
# Creates ~/.teamkb/ with secure permissions, initializes DB, seeds default policy.
set -euo pipefail

TEAMKB_DIR="${TEAMKB_BASE_PATH:-$HOME/.teamkb}"
DB_PATH="$TEAMKB_DIR/teamkb.db"
SPOOL_DIR="$TEAMKB_DIR/spool"
FEEDBACK_DIR="$TEAMKB_DIR/feedback"

# 1. Create directories with restricted permissions
mkdir -p "$TEAMKB_DIR" "$SPOOL_DIR" "$FEEDBACK_DIR"
chmod 700 "$TEAMKB_DIR" "$SPOOL_DIR" "$FEEDBACK_DIR"

# 2. Initialize database (idempotent — schema + migrations)
if [ -n "${CLAUDE_PLUGIN_DATA:-}" ]; then
  INIT_SCRIPT="$CLAUDE_PLUGIN_DATA/init-db.js"
else
  INIT_SCRIPT="${CLAUDE_PLUGIN_ROOT:-.}/apps/mcp-server/dist/init-db.js"
fi

if [ -f "$INIT_SCRIPT" ]; then
  TEAMKB_DB_PATH="$DB_PATH" node "$INIT_SCRIPT" 2>/dev/null || true
fi

# 3. If qmd is installed, ensure governed collections exist
if command -v qmd &>/dev/null; then
  for collection in kb-curated kb-decisions kb-guides; do
    qmd collection create "$collection" 2>/dev/null || true
  done
fi

# 4. Output status as JSON for Claude Code
QMD_AVAILABLE=false
if command -v qmd &>/dev/null; then
  QMD_AVAILABLE=true
fi
echo "{\"status\":\"ok\",\"db\":\"$DB_PATH\",\"qmd\":$QMD_AVAILABLE}"
