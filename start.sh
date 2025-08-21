#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$ROOT/api"
WEB_DIR="$ROOT/web"

# Config (override via env if needed)
API_PORT="${PORT:-4000}"
DB_URL="${DATABASE_URL:-file:./dev.db}"
ADMIN_ENABLED="${ADMIN_ENABLED:-false}"   # set true if using admin UI
# ADMIN_TOKEN can be provided via env

pids=()
cleanup() { for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done; }
trap cleanup EXIT INT TERM

# Start API
(
  cd "$API_DIR"
  echo "[api] starting on :$API_PORT"
  PORT="$API_PORT" DATABASE_URL="$DB_URL" ADMIN_ENABLED="$ADMIN_ENABLED" npm run dev
) &
pids+=($!)

# Wait for API to be ready
until curl -sf "http://localhost:$API_PORT/health" >/dev/null 2>&1; do sleep 0.5; done
echo "[api] ready"

# Start Web (dev)
(
  cd "$WEB_DIR"
  echo "[web] starting on :3000"
  NEXT_PUBLIC_API_BASE_URL="http://localhost:$API_PORT" npm run dev
) &
pids+=($!)

echo "[ok] API: http://localhost:$API_PORT  |  Web: http://localhost:3000"
wait