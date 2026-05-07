#!/bin/sh
set -e

# First-run initialization: populate GATEWAY_HOME with defaults
if [ ! -f "$GATEWAY_HOME/config.yaml" ]; then
  echo "[gateway] First run — initializing $GATEWAY_HOME"

  mkdir -p \
    "$GATEWAY_HOME/sessions" \
    "$GATEWAY_HOME/org" \
    "$GATEWAY_HOME/logs" \
    "$GATEWAY_HOME/tmp" \
    "$GATEWAY_HOME/skills" \
    "$GATEWAY_HOME/docs" \
    "$GATEWAY_HOME/files" \
    "$GATEWAY_HOME/cron/runs" \
    "$GATEWAY_HOME/.claude/skills" \
    "$GATEWAY_HOME/.agents/skills"

  cp /app/packages/jimmy/template/config.default.yaml "$GATEWAY_HOME/config.yaml"
  cp /app/packages/jimmy/template/CLAUDE.md "$GATEWAY_HOME/CLAUDE.md" 2>/dev/null || true
  cp /app/packages/jimmy/template/AGENTS.md "$GATEWAY_HOME/AGENTS.md" 2>/dev/null || true

  # Bind to all interfaces so the port is reachable from the host
  sed -i 's/host: "127.0.0.1"/host: "0.0.0.0"/' "$GATEWAY_HOME/config.yaml"

  echo "[gateway] Done. Edit $GATEWAY_HOME/config.yaml to customize."
fi

# Run pending migrations automatically
node /app/packages/jimmy/dist/bin/jimmy.js migrate 2>/dev/null || true

exec node /app/packages/jimmy/dist/bin/jimmy.js start
