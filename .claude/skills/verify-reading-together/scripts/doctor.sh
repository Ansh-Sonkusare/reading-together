#!/usr/bin/env bash
# Doctor: read-only health checks for a verify-reading-together run.
# Never starts, stops or resets Supabase, and never touches a dev server it
# did not itself find recorded in .verify/<run-id>/server.env.
#
# Usage: scripts/doctor.sh <run-id>
# Prints one PASS/FAIL line per check. Exits 0 only if every check passes.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
RUN_ID="${1:?usage: doctor.sh <run-id>}"
ENV_FILE=".verify/$RUN_ID/server.env"
FAIL=0

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
else
  echo "FAIL no server.env at $ENV_FILE — run scripts/launch.sh $RUN_ID first"
  PID=""
  PORT=""
  FAIL=1
fi

if [ -n "${PID:-}" ] && kill -0 "$PID" 2>/dev/null; then
  echo "PASS dev server pid $PID is alive"
else
  echo "FAIL dev server pid ${PID:-<unset>} is not running"
  FAIL=1
fi

# Walk the process-ancestry of whatever is listening on $PORT up to pid 1,
# looking for our own $PID (pnpm forks into `next dev`, which forks the
# actual next-server listener, so the listener is rarely $PID itself).
owns_port() {
  local port=$1 want=$2 listener anc
  listener=$(lsof -t -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -1)
  [ -z "$listener" ] && return 1
  anc=$listener
  while [ -n "$anc" ] && [ "$anc" != "1" ]; do
    [ "$anc" = "$want" ] && return 0
    anc=$(ps -o ppid= -p "$anc" 2>/dev/null | tr -d ' ')
  done
  return 1
}

if [ -n "${PORT:-}" ] && [ -n "${PID:-}" ] && owns_port "$PORT" "$PID"; then
  echo "PASS port $PORT is owned by our dev server (pid $PID or a descendant)"
else
  echo "FAIL port ${PORT:-<unset>} is not owned by pid ${PID:-<unset>}"
  FAIL=1
fi

if [ -n "${PORT:-}" ]; then
  # /login is public (no auth/couple/book preconditions), so it stays up
  # across app changes elsewhere — the readiness check launch.sh also polls.
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/login" 2>/dev/null)
  if [ "$CODE" = "200" ]; then
    echo "PASS GET /login -> 200"
  else
    echo "FAIL GET /login -> $CODE"
    FAIL=1
  fi

  # /dev/reader is a separate, dev-only check: it 404s in production and
  # depends on the reader feature specifically, so it's not the readiness
  # signal, but still worth knowing about before driving the reader.
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/dev/reader" 2>/dev/null)
  if [ "$CODE" = "200" ]; then
    echo "PASS GET /dev/reader -> 200"
  else
    echo "FAIL GET /dev/reader -> $CODE"
    FAIL=1
  fi
fi

if pnpm supabase status >/dev/null 2>&1; then
  echo "PASS pnpm supabase status reports the API up (read-only check)"
else
  echo "FAIL pnpm supabase status did not report the API up (read-only check; never starts/stops/resets it)"
  FAIL=1
fi

if docker info >/dev/null 2>&1; then
  echo "PASS docker is reachable"
else
  echo "FAIL docker is not reachable"
  FAIL=1
fi

exit $FAIL
