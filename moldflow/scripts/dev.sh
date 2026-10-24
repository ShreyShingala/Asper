#!/usr/bin/env bash
# Start API (:8000) + web (:3000). Usage: scripts/dev.sh [prod]   (prod = next build && next start, recommended for the demo)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
trap 'kill 0' EXIT
(cd "$ROOT/api" && uv run uvicorn app.main:app --port 8000 --workers 1) &
if [[ "${1:-}" == "prod" ]]; then
  (cd "$ROOT/web" && npm run build && npm run start -- --port 3000) &
else
  (cd "$ROOT/web" && npm run dev -- --port 3000) &
fi
wait
