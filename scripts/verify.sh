#!/usr/bin/env bash
# Invoice Forge smoke verify — Lauren Tan step 0
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PORT="${INVOICE_FORGE_PORT:-18081}"
export INVOICE_FORGE_PORT="$PORT"
PY="${ROOT}/.venv/bin/python"
PIP="${ROOT}/.venv/bin/pip"

fail() { echo "VERIFY FAIL: $*" >&2; exit 1; }
ok() { echo "VERIFY OK: $*"; }

test -f FEATURE_MAP.md || fail "FEATURE_MAP.md missing"
test -f server.py || fail "server.py missing"
test -f config.json.example || fail "config.json.example missing"

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
  ok "created .venv"
fi
if ! "$PY" -c "import fastapi, uvicorn" 2>/dev/null; then
  # Do not use pip install -e . — flat layout (static/, clients/) breaks setuptools discovery
  "$PIP" install -q 'fastapi>=0.109' 'uvicorn[standard]>=0.27' 'httpx>=0.26'
  if [[ "${PLAYWRIGHT_SKIP:-0}" != "1" ]]; then
    "$PIP" install -q 'playwright>=1.41' || true
  fi
  ok "installed runtime deps into .venv"
fi

if [[ ! -f config.json ]]; then
  cp config.json.example config.json
  ok "wrote config.json from example"
fi

fuser -k "${PORT}/tcp" 2>/dev/null || true
"$PY" server.py &
PID=$!
cleanup() { kill "$PID" 2>/dev/null || true; wait "$PID" 2>/dev/null || true; }
trap cleanup EXIT

for i in $(seq 1 40); do
  if curl -sf "http://127.0.0.1:${PORT}/api/invoices" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

curl -sf "http://127.0.0.1:${PORT}/api/invoices" >/dev/null || fail "GET /api/invoices"
ok "GET /api/invoices"
curl -sf "http://127.0.0.1:${PORT}/api/clients" >/dev/null || fail "GET /api/clients"
ok "GET /api/clients"
curl -sf "http://127.0.0.1:${PORT}/" | grep -qE 'invoiceSelect|Invoice Forge' || fail "GET / editor HTML"
ok "GET / editor"

if [[ "${PLAYWRIGHT_SKIP:-0}" == "1" ]]; then
  ok "PDF check skipped (PLAYWRIGHT_SKIP=1)"
elif "$PY" -c "from playwright.sync_api import sync_playwright" 2>/dev/null; then
  ok "playwright import ok (full PDF assert → Goal #1)"
else
  ok "playwright not installed — API smoke only"
fi

ok "all checks passed"
exit 0
