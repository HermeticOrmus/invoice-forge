# Gardener

Weed workaround patterns before the next agent copies them.

| Gardener | Role | Scope |
|----------|------|--------|
| Auric Lead | Chief of Staff | HermeticOrmus |
| Forge Foreman | Factory engineering manager | This repo (`invoice-forge`) |

## Job

A workaround comment is a pattern, not a note. If it lands, the next change will repeat it. Gardeners stop that here.

- **Forge Foreman** blocks the change in this tree. The fix is a refactor, or a lint/CI check when the same miss will recur in this repo.
- **Auric Lead** steps in when the same pattern is spreading across HermeticOrmus. The fix moves up the hierarchy below. Another local comment is not a fix.

Prefer the selectors and routes in `FEATURE_MAP.md`. Delete the footgun. Do not describe it in a comment.

## Hierarchy of correction

Use the cheapest control that will hold. Escalate only when the previous one cannot.

1. **Refactor** — remove the bad pattern in the change that introduced it.
2. **Lint / CI** — fail the build (`ruff check .`, `scripts/check-workaround-comments.sh`).
3. **Rules** — `CONTRIBUTING.md` (and this file) so agents are told before they edit.
4. **Skills** — a reusable agent skill when the same miss happens across repos.
5. **Style** — review habit, only after the mechanical gates exist.

Do not start at style. `temporary hack` in a comment is not a correction.
