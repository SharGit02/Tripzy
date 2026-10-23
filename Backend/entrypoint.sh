#!/bin/sh
set -eu

export FASTAPI_ML_BASE_URL="${FASTAPI_ML_BASE_URL:-http://127.0.0.1:8000}"
export ML_INTERNAL_API_KEY="${ML_INTERNAL_API_KEY:-${FASTAPI_ML_API_KEY:-}}"

cd /app/server

# ── Apply pending migrations before anything serves traffic ──────────────────
# A service pointed at a fresh database used to boot "healthy" (/api/health
# only runs `select 1`, which passes with no tables) and then 500 on every
# real query. `set -e` means a failed migration aborts the boot, which is the
# intended behaviour: a loud crash beats a running server that cannot read.
node dist/db/migrate.js

# ── Start the Express server FIRST so Render detects port 5000 immediately ───
# Previously the ML microservice started first and the 90-second health wait
# caused Render to log "No open ports detected, continuing to scan..." before
# Node.js even launched. Starting Node first eliminates that window.
node dist/index.js &
NODE_PID=$!

# ── Start the ML microservice in the background ───────────────────────────────
# Thanks to precomputed_stats.pkl (baked in at build time), startup is fast
# and memory usage stays well within Render's 512 MB limit.
cd /app/ml-microservice
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1 &
ML_PID=$!

# ── Graceful shutdown ─────────────────────────────────────────────────────────
cleanup() {
  kill "$NODE_PID" "$ML_PID" 2>/dev/null || true
}
trap cleanup INT TERM

# Keep the container alive as long as Node is running.
# If Node dies, also shut down the ML process.
wait "$NODE_PID"
status=$?
kill "$ML_PID" 2>/dev/null || true
exit "$status"
