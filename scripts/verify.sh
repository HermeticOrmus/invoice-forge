#!/usr/bin/env bash
# Invoice Forge smoke verify — API, open-folder confinement, PDF
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
test -f GARDENER.md || fail "GARDENER.md missing"
test -f server.py || fail "server.py missing"
test -f config.json.example || fail "config.json.example missing"
bash "$ROOT/scripts/check-workaround-comments.sh"

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
  ok "created .venv"
fi
if ! "$PY" -c "import fastapi, uvicorn, httpx" 2>/dev/null; then
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

# open-folder may only open paths that resolve inside output_dir.
# Bad paths must 4xx and must not spawn the file manager.
OUT_DIR=$("$PY" -c "import json; from pathlib import Path; c=json.loads(Path('config.json').read_text()); print(Path(c.get('output_dir','./invoices')).resolve())")
mkdir -p "$OUT_DIR"
"$PY" - <<'PY' || fail "open-folder confinement"
import json
import os
import shutil
import sys
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

import server

root = server.OUTPUT_DIR.resolve()
client = TestClient(server.app)
escape = root / "verify-escape-link"
inside = root / "verify-open.txt"
try:
    escape.symlink_to("/etc", target_is_directory=True)
    inside.write_text("verify\n", encoding="utf-8")
    cases = [
        ("/etc", 400),
        ("/etc/passwd", 400),
        ("../../etc/passwd", 400),
        ("../server.py", 400),
        (str(root) + "-evil", 400),
        (str(escape), 400),
        (str(root / ".." / "server.py"), 400),
        (str(inside), 200),
        ("verify-open.txt", 200),
        (str(root), 200),
        (".", 200),
    ]
    with patch("subprocess.Popen") as popen:
        for raw, expect in cases:
            popen.reset_mock()
            resp = client.post("/api/open-folder", json={"path": raw})
            if resp.status_code != expect:
                raise SystemExit(f"{raw!r}: expected {expect} got {resp.status_code} {resp.text}")
            opened = popen.call_args[0][0][1] if popen.called else None
            if expect == 400:
                if popen.called:
                    raise SystemExit(f"{raw!r}: file manager spawned for rejected path ({opened})")
            else:
                if not popen.called:
                    raise SystemExit(f"{raw!r}: in-bounds path was not opened")
                got = Path(opened).resolve()
                try:
                    got.relative_to(root)
                except ValueError:
                    raise SystemExit(f"{raw!r}: opened path escaped output dir: {got}") from None
        popen.reset_mock()
        missing = client.post("/api/open-folder", json={"path": "no-such-dir/file.pdf"})
        if missing.status_code != 404:
            raise SystemExit(f"missing in-bounds path: expected 404 got {missing.status_code} {missing.text}")
        if popen.called:
            raise SystemExit("file manager spawned for missing in-bounds path")
        default = client.post("/api/open-folder", json={})
        if default.status_code != 200:
            raise SystemExit(f"default path: expected 200 got {default.status_code} {default.text}")
        got = Path(default.json()["path"]).resolve()
        got.relative_to(root)
        popen.reset_mock()
        resp = client.post("/api/open-folder", json={"path": "verify-open.txt/../verify-open.txt"})
        if resp.status_code != 200 or not popen.called:
            raise SystemExit(f"normalized in-bounds ..: expected 200 got {resp.status_code} {resp.text}")
        got = Path(popen.call_args[0][0][1]).resolve()
        got.relative_to(root)
        for payload in ({"path": None}, {"path": "  "}, ["/etc"]):
            popen.reset_mock()
            resp = client.post("/api/open-folder", json=payload)
            if resp.status_code != 400 or popen.called:
                raise SystemExit(
                    f"bad payload {payload!r}: status {resp.status_code} spawned={popen.called} {resp.text}"
                )
finally:
    escape.unlink(missing_ok=True)
    inside.unlink(missing_ok=True)

# Live server: the running process must reject escapes itself.
import urllib.error
import urllib.request

base = f"http://127.0.0.1:{os.environ['INVOICE_FORGE_PORT']}/api/open-folder"
opener = {"win32": "explorer", "darwin": "open"}.get(sys.platform, "xdg-open")
escape.symlink_to("/etc", target_is_directory=True)
inside.write_text("verify\n", encoding="utf-8")
try:
    live_cases = [
        ({"path": "/etc"}, 400),
        ({"path": "/etc/passwd"}, 400),
        ({"path": "../../etc/passwd"}, 400),
        ({"path": str(escape)}, 400),
        ({"path": str(root) + "-evil"}, 400),
        ({"path": str(inside)}, 200),
        ({"path": "verify-open.txt"}, 200),
        ({"path": str(root)}, 200),
        ({}, 200),
    ]
    # Rejection is asserted against the running server either way.
    # In-bounds calls the real opener; skip those if it is not installed
    # (the mocked cases above already require 200 and an in-root path).
    if shutil.which(opener) is None:
        live_cases = [case for case in live_cases if case[1] != 200]
        print(f"live in-bounds open skipped; {opener} not on PATH")
    for payload, expect in live_cases:
        req = urllib.request.Request(
            base,
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                status = resp.status
                body = resp.read().decode()
        except urllib.error.HTTPError as exc:
            status = exc.code
            body = exc.read().decode()
        if status != expect:
            raise SystemExit(f"live {payload!r}: expected {expect} got {status} {body}")
        if status == 400 and "outside" not in body and "non-empty" not in body:
            raise SystemExit(f"live {payload!r}: 400 detail is not explicit: {body}")
        if status == 200:
            got = Path(json.loads(body)["path"]).resolve()
            try:
                got.relative_to(root)
            except ValueError:
                raise SystemExit(f"live {payload!r}: opened path escaped output dir: {got}") from None
finally:
    escape.unlink(missing_ok=True)
    inside.unlink(missing_ok=True)
print("open-folder confinement ok")
PY
ok "POST /api/open-folder stays inside output_dir"

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
