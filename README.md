<p align="center">
  <img src="https://ormus.solutions/mascot/pixellab_liquid_to_crown.gif" alt="Invoice Forge" width="128" style="image-rendering: pixelated;" />
</p>

<h1 align="center">Invoice Forge</h1>

<p align="center">
  <em>Self-hosted invoice editor for freelancers. FastAPI + Playwright PDF export. JSON-backed, zero database.</em>
</p>

<p align="center">
  <a href="https://github.com/HermeticOrmus/invoice-forge/stargazers"><img src="https://img.shields.io/github/stars/HermeticOrmus/invoice-forge?style=flat-square&color=aa8142" alt="Stars" /></a>
  <a href="https://github.com/HermeticOrmus/invoice-forge/blob/main/LICENSE"><img src="https://img.shields.io/github/license/HermeticOrmus/invoice-forge?style=flat-square&color=aa8142" alt="License" /></a>
  <a href="https://github.com/HermeticOrmus/invoice-forge/commits"><img src="https://img.shields.io/github/last-commit/HermeticOrmus/invoice-forge?style=flat-square&color=aa8142" alt="Last Commit" /></a>
  <img src="https://img.shields.io/badge/Claude_Code-aa8142?style=flat-square&logo=anthropic&logoColor=white" alt="Claude Code" />
</p>

---
Self-hosted invoice editor for freelancers. FastAPI backend, Playwright PDF export, JSON storage -- zero database required.

## Screenshot

> The editor presents a dark-themed interface with a fixed toolbar at the top (invoice selector, new/refresh/PDF/theme buttons). Below is a live-editable invoice document: company header with logo, client details, draggable line items table, discounts, totals with automatic tax calculation, payment info, notes, and footer. All fields are inline-editable. Light theme available via toggle.

## Quick Start

```bash
# Clone
git clone https://github.com/HermeticOrmus/invoice-forge.git
cd invoice-forge

# Install dependencies
pip install -e .

# Install Playwright browser (first time only)
playwright install chromium

# Configure
cp config.json.example config.json
# Edit config.json with your company details

# Run
python server.py
# Open http://localhost:8081
```

### Port Configuration

Default port is 8081. Override with an environment variable:

```bash
INVOICE_FORGE_PORT=9000 python server.py
```

## Configuration

Copy `config.json.example` to `config.json` and fill in your details:

| Field | Description |
|-------|-------------|
| `company.name` | Your company or freelance name |
| `company.address` | Business address |
| `company.email` | Billing email |
| `company.phone` | Phone number |
| `company.website` | Website URL |
| `payment.bank_name` | Bank name |
| `payment.account_holder` | Account holder name |
| `payment.account_number` | Account number |
| `payment.additional_methods` | Array of payment method strings |
| `invoice_prefix` | Default prefix for invoice IDs (e.g. "INV") |
| `currency` | Default currency code |
| `output_dir` | Where generated PDFs are saved |

### Logo

Place a `logo.png` in `static/` to display your company logo on invoices. If absent, only the company name is shown.

### Clients

Edit `clients/clients.json` to add your client database. Clients can also be saved from within the editor UI.

## Features

- **Inline editing** -- every field is editable directly on the invoice
- **Auto-save** -- 500ms debounce, Ctrl+S for immediate save
- **Auto-calculate** -- line totals, tax, discounts, grand total
- **PDF export** -- Playwright renders pixel-perfect PDFs via Chromium
- **Client database** -- save and recall clients from a JSON file
- **Section toggle** -- show/hide discounts, payment, notes, footer per invoice
- **Drag-and-drop** -- reorder line items by dragging
- **Dark/light theme** -- toggle via toolbar button
- **Config-driven** -- company info, payment details, and defaults from `config.json`
- **Zero database** -- all data stored as flat JSON files
- **Nested filing** -- invoices organized by `documents/{client}/{year-month}/`

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Serve editor UI |
| GET | `/api/invoices` | List all invoices |
| GET | `/api/invoices/{id}` | Get invoice by ID |
| PUT | `/api/invoices/{id}` | Save invoice |
| POST | `/api/invoices` | Create new invoice |
| POST | `/api/invoices/{id}/pdf` | Generate PDF |
| GET | `/api/clients` | List clients |
| PUT | `/api/clients` | Save client database |

## File Structure

```
server.py              # FastAPI server (CRUD + PDF generation)
config.json            # Your configuration (gitignored)
config.json.example    # Template configuration
static/
  editor.html          # Editor UI
  editor.js            # Editor logic
  editor.css           # Editor chrome (toolbar, controls)
  invoice.css          # Invoice document styles (editor + PDF)
  pdf-template.html    # HTML wrapper for PDF rendering
  logo.png             # Your logo (optional, gitignored)
clients/
  clients.json         # Client database
documents/             # Invoice JSON files (gitignored)
invoices/              # Generated PDFs (gitignored)
```

## Requirements

- Python 3.11+
- Playwright with Chromium (`playwright install chromium`)

## License

MIT + [Gold Hat Addendum](LICENSE) -- use this to empower, not extract.

---

## Part of the Libre Open-Source Stack for Claude Code

This repository is part of a growing family of open-source toolkits for Claude Code.

### Libre suite — comprehensive plugin bundles

- [LibreUIUX-Claude-Code](https://github.com/HermeticOrmus/LibreUIUX-Claude-Code) — UI/UX development (152 agents, 70 plugins, 76 commands, 74 skills)
- [LibreArch-Claude-Code](https://github.com/HermeticOrmus/LibreArch-Claude-Code) — Software architecture and system design
- [LibreCopy-Claude-Code](https://github.com/HermeticOrmus/LibreCopy-Claude-Code) — Technical writing and documentation engineering
- [LibreDevOps-Claude-Code](https://github.com/HermeticOrmus/LibreDevOps-Claude-Code) — DevOps engineering and infrastructure automation
- [LibreEmbed-Claude-Code](https://github.com/HermeticOrmus/LibreEmbed-Claude-Code) — Embedded systems, firmware, and IoT development
- [LibreFinTech-Claude-Code](https://github.com/HermeticOrmus/LibreFinTech-Claude-Code) — Financial technology development
- [LibreGEO-Claude-Code](https://github.com/HermeticOrmus/LibreGEO-Claude-Code) — AI-search optimization (ChatGPT, Perplexity, Gemini, Google AI Overviews)
- [LibreGameDev-Claude-Code](https://github.com/HermeticOrmus/LibreGameDev-Claude-Code) — Game development across Godot, Unity, Unreal
- [LibreMLOps-Claude-Code](https://github.com/HermeticOrmus/LibreMLOps-Claude-Code) — ML engineering and AI operations
- [LibreMobileDev-Claude-Code](https://github.com/HermeticOrmus/LibreMobileDev-Claude-Code) — Mobile app development (Flutter, React Native, native iOS, native Android)
- [LibreSecOps-Claude-Code](https://github.com/HermeticOrmus/LibreSecOps-Claude-Code) — Security operations

### Skills mini-repos — single CLAUDE.md drop-ins

- [vibe-engineer-skills](https://github.com/HermeticOrmus/vibe-engineer-skills) — Direct AI codegen well (hypothesis → scope → validate → reject working-but-wrong)
- [markdown-discipline-skills](https://github.com/HermeticOrmus/markdown-discipline-skills) — Strip AI-slop from markdown (no em dashes, no marketing fluff)
- [shell-safety-skills](https://github.com/HermeticOrmus/shell-safety-skills) — `set -euo pipefail` discipline + 15 failure-mode examples
- [commit-standard-skills](https://github.com/HermeticOrmus/commit-standard-skills) — Ormus Commit Standard v1.0 + commit-msg hook + commitlint
- [unwoke-skills](https://github.com/HermeticOrmus/unwoke-skills) — Strip AI theater (ten sins to eliminate, symmetric engagement)
- [python-conventions-skills](https://github.com/HermeticOrmus/python-conventions-skills) — Modern Python 3.11+ (types, pathlib, async, ruff, mypy, uv)
- [typescript-conventions-skills](https://github.com/HermeticOrmus/typescript-conventions-skills) — TypeScript strict mode, discriminated unions, Result types
- [hermetic-laws-skills](https://github.com/HermeticOrmus/hermetic-laws-skills) — Seven Hermetic Principles applied to engineering
- [riper-workflow-skills](https://github.com/HermeticOrmus/riper-workflow-skills) — Research / Innovate / Plan / Execute / Review systematic dev
- [six-day-cycle-skills](https://github.com/HermeticOrmus/six-day-cycle-skills) — Sustainable shipping cadence with mandatory rest
- [token-optimization-skills](https://github.com/HermeticOrmus/token-optimization-skills) — Claude Code token + context optimization
- [osint-skills](https://github.com/HermeticOrmus/osint-skills) — OSINT research methodology (multi-wave investigative spiral)
- [calcinate-skills](https://github.com/HermeticOrmus/calcinate-skills) — Stage 1 of the Magnum Opus (burn project bloat)
- [claude-md-overhaul-skills](https://github.com/HermeticOrmus/claude-md-overhaul-skills) — Audit CLAUDE.md and MEMORY.md against caps
- [session-handoff-skills](https://github.com/HermeticOrmus/session-handoff-skills) — Session handoff + pickup discipline
- [naming-skills](https://github.com/HermeticOrmus/naming-skills) — Product naming methodology (mine the brand's vocabulary)
- [magnum-opus-skills](https://github.com/HermeticOrmus/magnum-opus-skills) — Seven-stage alchemy applied to project transformation

### Template source

- [andrej-karpathy-skills](https://github.com/HermeticOrmus/andrej-karpathy-skills) — the canonical single-file CLAUDE.md pattern (fork of jiayuan_jy's original)

Star the family, not just one — that's how the suite stays coherent.
