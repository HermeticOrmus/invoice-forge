#!/usr/bin/env bash
# Invoice Forge smoke verify — Lauren Tan (Goal #0 API + Goal #1 PDF)
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
  ok "installed runtime deps into .venv"
fi

# VERIFY_PDF=1 forces playwright install; default tries PDF when import works
want_pdf=0
if [[ "${PLAYWRIGHT_SKIP:-0}" == "1" ]]; then
  want_pdf=0
elif [[ "${VERIFY_PDF:-0}" == "1" ]]; then
  want_pdf=1
  if ! "$PY" -c "from playwright.sync_api import sync_playwright" 2>/dev/null; then
    "$PIP" install -q 'playwright>=1.41' || fail "VERIFY_PDF=1 but playwright pip install failed"
  fi
elif "$PY" -c "from playwright.sync_api import sync_playwright" 2>/dev/null; then
  want_pdf=1
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
elif [[ "$want_pdf" -eq 1 ]]; then
  "$PY" -c "from playwright.sync_api import sync_playwright" 2>/dev/null \
    || fail "playwright import required for PDF check (set PLAYWRIGHT_SKIP=1 to skip)"
  # Ensure Chromium (or headless shell) is present; install once if missing
  if ! "$PY" -c "
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch()
    b.close()
" 2>/dev/null; then
    "$PY" -m playwright install chromium || fail "playwright install chromium failed"
  fi
  CREATE=$(curl -sf -X POST "http://127.0.0.1:${PORT}/api/invoices" \
    -H 'Content-Type: application/json' \
    -d '{"client_code":"VERIFY","client":{"name":"Verify Client","address":"1 Verify St","email":"verify@example.com"}}') \
    || fail "POST /api/invoices create"
  DOC_ID=$("$PY" -c "import json,sys; print(json.loads(sys.argv[1])['id'])" "$CREATE")
  [[ -n "$DOC_ID" ]] || fail "create response missing id"
  ok "POST /api/invoices → $DOC_ID"
  PDF_RESP=$(curl -sf -X POST "http://127.0.0.1:${PORT}/api/invoices/${DOC_ID}/pdf") \
    || fail "POST /api/invoices/{id}/pdf"
  FILENAME=$("$PY" -c "import json,sys; print(json.loads(sys.argv[1])['filename'])" "$PDF_RESP")
  [[ -n "$FILENAME" ]] || fail "pdf response missing filename"
  PDF_PATH="${ROOT}/invoices/${FILENAME}"
  test -f "$PDF_PATH" || fail "PDF file missing: $PDF_PATH"
  SIZE=$(stat -c%s "$PDF_PATH" 2>/dev/null || wc -c < "$PDF_PATH")
  [[ "$SIZE" -gt 0 ]] || fail "PDF file empty: $PDF_PATH"
  ok "PDF $FILENAME (${SIZE} bytes)"
else
  ok "playwright not installed — API smoke only (VERIFY_PDF=1 to force)"
fi

ok "all checks passed"
exit 0
