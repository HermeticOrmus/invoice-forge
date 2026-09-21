# Invoice Forge — Feature map

Agent-facing map for Lauren Tan / poteto-mode. Prefer these selectors and routes; do not invent soft “try to find the button” steps.

## Surfaces
| Surface | Entry | Notes |
|---------|--------|--------|
| Editor UI | `GET /` → `static/editor.html` | Dark default; light via `#btnTheme` |
| API | FastAPI in `server.py` | JSON files, no DB |
| PDF | `POST /api/invoices/{id}/pdf` | Playwright Chromium |
| Config | `config.json` (from `config.json.example`) | gitignored |
| Clients | `clients/clients.json` | Also `GET/PUT /api/clients` |
| Invoices | `documents/{client}/{year-month}/` | Nested filing |

## Toolbar (stable IDs)
| Control | Selector | Behavior |
|---------|----------|----------|
| Invoice list | `#invoiceSelect` | `change` → load invoice |
| New | `#btnNew` | Opens `#newInvoiceModal` |
| Refresh | `#btnRefresh` | Reload list |
| Sync status | `#syncStatus` | Ready / Saving / Saved |
| Sections menu | `#btnSections` → `#sectionsMenu` | toggles discounts/payment/notes/footer via `input[data-section]` |
| PDF | `#btnPdf` | Export PDF |
| Open folder | `#btnOpenFolder` | Hidden until PDF path known |
| Theme | `#btnTheme` | Toggles `data-theme="light"` on `<html>` |

## New invoice modal
| Control | Selector |
|---------|----------|
| Modal | `#newInvoiceModal` (class `hidden` when closed) |
| Client | `#newInvClient` |
| Code prefix | `#newInvCode` |
| Create | `#btnCreateInv` |
| Cancel | `#btnCancelNew` |

## Invoice document (contenteditable / inputs)
| Field | Selector |
|-------|----------|
| Company name | `#companyName` |
| Company details | `#companyDetails` |
| Title | `#invTitle` |
| Number | `#invNumber` |
| Date / Due | `#invDate`, `#invDueDate` |
| Status | `#invStatus` (`draft`\|`sent`\|`paid`\|`overdue`) |
| Client pick / save | `#clientSelect`, `#btnSaveClient` |
| Client fields | `#clientName`, `#clientAddr`, `#clientRuc`, `#clientEmail` |
| Line items body | `#itemsBody` |
| Add item | `#btnAddItem` |
| Discounts section | `#section-discounts`, `#btnAddDiscount` |
| Totals | `#totalsArea` |
| Payment / notes / footer | `#section-payment`, `#section-notes`, `#section-footer` (confirm IDs in HTML if extended) |

## Keyboard
- **Ctrl+S** (or Cmd+S): immediate save (see `editor.js` keydown handler)

## API (hard contract)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Editor |
| GET | `/api/invoices` | List |
| GET | `/api/invoices/{id}` | Get |
| PUT | `/api/invoices/{id}` | Save |
| POST | `/api/invoices` | Create |
| POST | `/api/invoices/{id}/pdf` | PDF |
| POST | `/api/open-folder` | Open a path under `output_dir` only. Traversal, symlinks, and absolute paths that resolve outside that root return 400 |
| GET | `/api/clients` | List clients |
| PUT | `/api/clients` | Save clients |

Default port: **8081** (`INVOICE_FORGE_PORT` override).

## Hard constraints (agents)
1. Do not require a database; persist JSON only.
2. Do not rename stable `#id` selectors without updating this map + verify script in the same change.
3. PDF path needs Playwright Chromium installed; verify may skip PDF if `PLAYWRIGHT_SKIP=1` but must still document it.
4. Never commit real `config.json` or live client PII; use example/fixture data in tests.
5. Atomic PRs: one concern (map, verify, or one feature) — not mixed.

## Verify
Run `scripts/verify.sh` from repo root; exit 0 required before claiming Goal done.

| Mode | Env | Behavior |
|------|-----|----------|
| Default | (none) | API smoke; if Playwright import works, create invoice → `POST /api/invoices/{id}/pdf` → assert `invoices/*.pdf` size > 0 |
| API-only | `PLAYWRIGHT_SKIP=1` | Skip PDF path |
| Force PDF | `VERIFY_PDF=1` | Install Playwright if needed; fail if PDF cannot be produced |

PDF files land under `output_dir` (default `./invoices/`, gitignored). Probe fixture client_code: `VERIFY`.
