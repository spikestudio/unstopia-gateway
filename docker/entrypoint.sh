#!/bin/sh
set -e

# First-run initialization: populate JINN_HOME with defaults
if [ ! -f "$JINN_HOME/config.yaml" ]; then
  echo "[jinn] First run — initializing $JINN_HOME"

  mkdir -p \
    "$JINN_HOME/sessions" \
    "$JINN_HOME/org" \
    "$JINN_HOME/logs" \
    "$JINN_HOME/tmp" \
    "$JINN_HOME/skills" \
    "$JINN_HOME/docs" \
    "$JINN_HOME/files" \
    "$JINN_HOME/cron/runs" \
    "$JINN_HOME/.claude/skills" \
    "$JINN_HOME/.agents/skills"

  cp /app/packages/jimmy/template/config.default.yaml "$JINN_HOME/config.yaml"
  cp /app/packages/jimmy/template/CLAUDE.md "$JINN_HOME/CLAUDE.md" 2>/dev/null || true
  cp /app/packages/jimmy/template/AGENTS.md "$JINN_HOME/AGENTS.md" 2>/dev/null || true

  # Bind to all interfaces so the port is reachable from the host
  sed -i 's/host: "127.0.0.1"/host: "0.0.0.0"/' "$JINN_HOME/config.yaml"

  echo "[jinn] Done. Edit $JINN_HOME/config.yaml to customize."
fi

# Run pending migrations automatically
node /app/packages/jimmy/dist/bin/jimmy.js migrate 2>/dev/null || true

exec node /app/packages/jimmy/dist/bin/jimmy.js start
