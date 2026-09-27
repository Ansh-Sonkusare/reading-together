#!/usr/bin/env bash
# Launch the Next.js dev server for verification, pointed at the already-running
# local Supabase stack. Never starts, stops or resets Supabase.
#
# Usage: scripts/launch.sh [run-id]
#   run-id defaults to a timestamp. Prints run-id/port/pid/log, and blocks until
#   GET /dev/reader answers 200 (or times out after 60s).
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

RUN_ID="${1:-$(date +%Y%m%d-%H%M%S)}"
OUT_DIR=".verify/$RUN_ID"
mkdir -p "$OUT_DIR"

# Port: 3100 + hash(worktree path) mod 800, then scan forward for a free one
# so two worktrees whose paths happen to hash close together don't collide.
HASH=$(pwd | cksum | awk '{print $1}')
BASE_PORT=$((3100 + HASH % 800))
PORT="$BASE_PORT"
for i in $(seq 0 50); do
  P=$((BASE_PORT + i))
  if ! lsof -nP -iTCP:"$P" -sTCP:LISTEN >/dev/null 2>&1; then
    PORT=$P
    break
  fi
done

# .env.local: only create it if missing, from the running Supabase stack's own
# status output. Never overwrites an existing one.
if [ ! -f .env.local ]; then
  ENV_KV=$(pnpm supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')
  API_URL=$(printf '%s\n' "$ENV_KV" | grep '^API_URL=' | cut -d= -f2- | tr -d '"')
  ANON_KEY=$(printf '%s\n' "$ENV_KV" | grep '^ANON_KEY=' | cut -d= -f2- | tr -d '"')
  SERVICE_ROLE_KEY=$(printf '%s\n' "$ENV_KV" | grep '^SERVICE_ROLE_KEY=' | cut -d= -f2- | tr -d '"')
  if [ -z "$API_URL" ] || [ -z "$ANON_KEY" ]; then
    echo "FAIL could not read 'pnpm supabase status -o env' — is the local stack running? (this script never starts it)" >&2
    exit 1
  fi
  cat > .env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
EOF
  echo "wrote .env.local from pnpm supabase status -o env"
fi

LOG="$OUT_DIR/dev-server.log"
pnpm dev --port "$PORT" > "$LOG" 2>&1 &
PID=$!

{
  echo "RUN_ID=$RUN_ID"
  echo "PORT=$PORT"
  echo "PID=$PID"
  echo "LOG=$LOG"
} > "$OUT_DIR/server.env"

echo "launching: run=$RUN_ID pid=$PID port=$PORT log=$LOG"
for i in $(seq 1 60); do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/dev/reader" 2>/dev/null)
  if [ "$CODE" = "200" ]; then
    echo "ready: http://localhost:$PORT/dev/reader -> 200 (after ${i}s)"
    exit 0
  fi
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "FAIL dev server exited early; tail of $LOG:" >&2
    tail -n 40 "$LOG" >&2
    exit 1
  fi
  sleep 1
done
echo "FAIL timed out waiting for /dev/reader to answer 200" >&2
tail -n 40 "$LOG" >&2
exit 1
