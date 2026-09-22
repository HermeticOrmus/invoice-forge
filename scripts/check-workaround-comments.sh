#!/usr/bin/env bash
# Fail when .py / .js / .ts contain workaround-comment markers.
# Policy: CONTRIBUTING.md. Owners: GARDENER.md.
# Keep the phrase list short. Do not drop a phrase to land a change.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

files=()
while IFS= read -r -d '' f; do
  files+=("$f")
done < <(find . -type f \
  \( -name '*.py' -o -name '*.js' -o -name '*.ts' \) \
  -not -path './.git/*' \
  -not -path './.venv/*' \
  -not -path './node_modules/*' \
  -not -path '*/__pycache__/*' \
  -print0)

if ((${#files[@]} == 0)); then
  echo "workaround-comment fence: no .py/.js/.ts files"
  exit 0
fi

status=0
# Case-insensitive. Substring on purpose: "workarounds" is the same footgun.
# HACK: keeps the colon so plain words (hacker, hackathon) do not match.
if grep -n -E -i \
  -e 'workaround' \
  -e 'temporary hack' \
  -e 'try to find the button' \
  -e 'HACK:' \
  "${files[@]}"; then
  status=1
fi

if ((status != 0)); then
  echo "workaround-comment fence: banned marker in .py/.js/.ts — see CONTRIBUTING.md" >&2
  exit 1
fi

echo "workaround-comment fence: clean"
