#!/usr/bin/env bash
# Cleanup: stop only the dev server process tree that launch.sh started for
# this run-id. Never kills by process name, never touches Supabase/Docker,
# and never deletes .verify — evidence survives cleanup.
#
# Usage: scripts/cleanup.sh <run-id>
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
RUN_ID="${1:?usage: cleanup.sh <run-id>}"
ENV_FILE=".verify/$RUN_ID/server.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "nothing to clean up: $ENV_FILE not found (already cleaned up, or launch.sh never ran for $RUN_ID)"
  exit 0
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

# pnpm dev forks into `next dev`, which forks the actual next-server process,
# so a plain `kill $PID` leaves children running. Kill the whole tree.
kill_tree() {
  local pid=$1 c
  for c in $(pgrep -P "$pid" 2>/dev/null); do kill_tree "$c"; done
  kill -TERM "$pid" 2>/dev/null || true
}

if [ -n "${PID:-}" ] && kill -0 "$PID" 2>/dev/null; then
  kill_tree "$PID"
  sleep 1
  kill -9 "$PID" 2>/dev/null || true
  echo "stopped dev server pid $PID (port ${PORT:-?})"
else
  echo "dev server pid ${PID:-<unknown>} was already stopped"
fi

echo "evidence preserved at .verify/$RUN_ID (cleanup never deletes .verify)"
