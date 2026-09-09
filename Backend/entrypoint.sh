#!/bin/sh
set -eu

export FASTAPI_ML_BASE_URL="${FASTAPI_ML_BASE_URL:-http://127.0.0.1:8000}"
export ML_INTERNAL_API_KEY="${ML_INTERNAL_API_KEY:-${FASTAPI_ML_API_KEY:-}}"

cd /app/ml-microservice
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &
ML_PID=$!

python3 - <<'PY'
import time
import urllib.request

for _ in range(90):
    try:
        urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=2)
        break
    except Exception:
        time.sleep(1)
PY

cd /app/server
node dist/index.js &
NODE_PID=$!

cleanup() {
  kill "$NODE_PID" "$ML_PID" 2>/dev/null || true
}
trap cleanup INT TERM

wait "$NODE_PID"
status=$?
kill "$ML_PID" 2>/dev/null || true
exit "$status"
