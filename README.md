# Invoice Forge

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
