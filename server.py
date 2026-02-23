"""Invoice Forge - Self-hosted invoice editor.

FastAPI server: CRUD for invoices/clients, PDF generation via Playwright.
Invoices organized: documents/{client_id}/{year-month}/{invoice_id}.json
Configuration loaded from config.json (see config.json.example).
"""

import json
import os
import re
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Invoice Forge")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"
DOCS_DIR = BASE_DIR / "documents"
CLIENTS_DIR = BASE_DIR / "clients"

# --- Configuration ---

CONFIG_PATH = BASE_DIR / "config.json"

def load_config() -> dict:
    """Load configuration from config.json, falling back to defaults."""
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    return {
        "company": {
            "name": "Your Company",
            "address": "123 Main St, City, Country",
            "email": "billing@example.com",
            "phone": "+1-555-0100",
            "website": "https://example.com",
        },
        "payment": {
            "bank_name": "Your Bank",
            "account_holder": "Your Name",
            "account_number": "XXXX-XXXX-XXXX",
            "additional_methods": [],
        },
        "invoice_prefix": "INV",
        "currency": "USD",
        "output_dir": "./invoices",
    }


CONFIG = load_config()
OUTPUT_DIR = Path(CONFIG.get("output_dir", "./invoices")).resolve()

for d in [DOCS_DIR, CLIENTS_DIR, OUTPUT_DIR]:
    d.mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/output", StaticFiles(directory=str(OUTPUT_DIR)), name="output")


# --- Path Resolution Helpers ---

def _load_client_map() -> dict:
    """Build client_code -> client_id mapping from clients.json."""
    path = CLIENTS_DIR / "clients.json"
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return {c["code"]: c["id"] for c in data.get("clients", []) if "code" in c and "id" in c}


def _parse_doc_id(doc_id: str) -> tuple[str, str]:
    """Extract (client_code, year_month) from invoice ID.

    BG-INV-022026-001 -> ('BG', '2026-02')
    """
    match = re.match(r"^([A-Z]+)-INV-(\d{2})(\d{4})-\d+$", doc_id)
    if not match:
        return ("", "")
    code = match.group(1)
    month = match.group(2)
    year = match.group(3)
    return (code, f"{year}-{month}")


def _resolve_doc_dir(doc_id: str) -> Path:
    """Return the nested directory for an invoice ID, creating it if needed."""
    code, year_month = _parse_doc_id(doc_id)
    client_map = _load_client_map()
    client_folder = client_map.get(code, code.lower())
    doc_dir = DOCS_DIR / client_folder / year_month
    doc_dir.mkdir(parents=True, exist_ok=True)
    return doc_dir


def _find_doc_path(doc_id: str) -> Path | None:
    """Find an existing invoice JSON, checking nested then flat (backward compat)."""
    nested = _resolve_doc_dir(doc_id) / f"{doc_id}.json"
    if nested.exists():
        return nested
    flat = DOCS_DIR / f"{doc_id}.json"
    if flat.exists():
        return flat
    return None


# --- Pages ---

@app.get("/", response_class=HTMLResponse)
async def index():
    return (STATIC_DIR / "editor.html").read_text(encoding="utf-8")


# --- Invoice CRUD ---

@app.get("/api/invoices")
async def list_invoices():
    invoices = []
    for f in sorted(DOCS_DIR.rglob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            meta = data.get("meta", {})
            client = data.get("client", {})
            totals = data.get("totals", {})
            invoices.append({
                "id": f.stem,
                "invoice_number": meta.get("invoice_number", f.stem),
                "date": meta.get("date", ""),
                "status": meta.get("status", "draft"),
                "client_name": client.get("name", ""),
                "total": totals.get("total", 0),
            })
        except (json.JSONDecodeError, KeyError):
            continue
    return invoices


@app.get("/api/invoices/{doc_id}")
async def get_invoice(doc_id: str):
    path = _find_doc_path(doc_id)
    if not path:
        raise HTTPException(404, "Invoice not found")
    return json.loads(path.read_text(encoding="utf-8"))


@app.put("/api/invoices/{doc_id}")
async def save_invoice(doc_id: str, request: Request):
    data = await request.json()
    doc_dir = _resolve_doc_dir(doc_id)
    path = doc_dir / f"{doc_id}.json"
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    # Clean up flat file if it exists separately
    flat = DOCS_DIR / f"{doc_id}.json"
    if flat.exists() and flat != path:
        flat.unlink()
    return {"status": "saved", "id": doc_id}


@app.post("/api/invoices")
async def create_invoice(request: Request):
    data = await request.json()
    prefix = CONFIG.get("invoice_prefix", "INV")
    client_code = data.get("client_code", prefix)
    now = datetime.now()
    month_year = now.strftime("%m%Y")
    id_prefix = f"{client_code}-INV-{month_year}"

    # Count existing across nested structure
    existing = list(DOCS_DIR.rglob(f"{id_prefix}-*.json"))
    seq = len(existing) + 1
    doc_id = f"{id_prefix}-{seq:03d}"

    company_cfg = CONFIG.get("company", {})
    payment_cfg = CONFIG.get("payment", {})
    currency = CONFIG.get("currency", "USD")

    # Build payment methods string from config
    methods = payment_cfg.get("additional_methods", [])
    payment_methods_str = ", ".join(methods) if methods else "Bank Transfer"

    invoice = {
        "meta": {
            "id": doc_id,
            "invoice_number": doc_id,
            "date": now.strftime("%Y-%m-%d"),
            "due_date": "",
            "status": "draft",
            "currency": currency,
            "language": "en",
        },
        "company": {
            "name": company_cfg.get("name", "Your Company"),
            "address": company_cfg.get("address", ""),
            "phone": company_cfg.get("phone", ""),
            "email": company_cfg.get("email", ""),
            "website": company_cfg.get("website", ""),
            "bank": {
                "name": payment_cfg.get("bank_name", ""),
                "account": payment_cfg.get("account_number", ""),
                "holder": payment_cfg.get("account_holder", ""),
            },
        },
        "client": data.get("client", {
            "name": "",
            "address": "",
            "ruc": "",
            "email": "",
        }),
        "items": [],
        "discounts": [],
        "totals": {
            "subtotal": 0,
            "discount_total": 0,
            "tax_amount": 0,
            "total": 0,
        },
        "settings": {
            "tax_rate": 0.0,
            "tax_label": "Tax",
            "payment_terms": data.get("payment_terms", "Net 30"),
            "payment_methods": payment_methods_str,
        },
        "notes": "",
    }

    doc_dir = _resolve_doc_dir(doc_id)
    path = doc_dir / f"{doc_id}.json"
    path.write_text(json.dumps(invoice, indent=2, ensure_ascii=False), encoding="utf-8")
    return {"status": "created", "id": doc_id, "invoice": invoice}


# --- Client CRUD ---

def _clients_path():
    return CLIENTS_DIR / "clients.json"


@app.get("/api/clients")
async def get_clients():
    path = _clients_path()
    if not path.exists():
        return {"clients": []}
    return json.loads(path.read_text(encoding="utf-8"))


@app.put("/api/clients")
async def save_clients(request: Request):
    data = await request.json()
    path = _clients_path()
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    return {"status": "saved"}


# --- PDF Generation ---

def render_invoice_html(doc: dict) -> str:
    """Build invoice HTML from data for PDF rendering.

    Respects doc.display overrides and doc.hidden_sections.
    """
    import base64

    meta = doc.get("meta", {})
    company = doc.get("company", {})
    client = doc.get("client", {})
    items = doc.get("items", [])
    discounts = doc.get("discounts", [])
    totals = doc.get("totals", {})
    settings = doc.get("settings", {})
    notes = doc.get("notes", "")
    bank = company.get("bank", {})
    display = doc.get("display", {})
    hidden = doc.get("hidden_sections", [])

    def fmt(n):
        return f"{float(n):,.2f}"

    def is_visible(section_name):
        return section_name not in hidden

    # Company details: use display override or build from structured data
    if display.get("company_details"):
        company_details_html = display["company_details"].replace("\n", "<br>")
    else:
        company_addr = company.get("address", "").replace("\n", "<br>")
        company_details_html = (
            f"{company_addr}<br>"
            f"Tel: {company.get('phone', '')}<br>"
            f"{company.get('email', '')}<br>"
            f"{company.get('website', '')}"
        )

    client_addr = client.get("address", "").replace("\n", "<br>")
    inv_title = display.get("title") or "INVOICE"

    # Embed logo as base64 for reliable PDF rendering
    logo_path = STATIC_DIR / "logo.png"
    if logo_path.exists():
        logo_b64 = base64.b64encode(logo_path.read_bytes()).decode()
        logo_html = f'<img class="inv-logo" src="data:image/png;base64,{logo_b64}" alt="{company.get("name", "")}">'
    else:
        logo_html = ""

    html = f"""
    <div class="inv-header">
      <div class="inv-company">
        <div class="inv-company-brand">
          {logo_html}
          <div class="inv-company-name">{company.get('name', '')}</div>
        </div>
        <div class="inv-company-details">{company_details_html}</div>
      </div>
      <div class="inv-meta">
        <div class="inv-title">{inv_title}</div>
        <div class="inv-number">#{meta.get('invoice_number', '')}</div>
        <table class="inv-meta-table">
          <tr><td>Date:</td><td>{meta.get('date', '')}</td></tr>
          <tr><td>Due:</td><td>{meta.get('due_date', '')}</td></tr>
          <tr><td>Status:</td><td>{meta.get('status', 'draft').upper()}</td></tr>
        </table>
      </div>
    </div>

    <div class="inv-client-section">
      <div class="inv-client-label">Bill to:</div>
      <div class="inv-client-name">{client.get('name', '')}</div>
      <div class="inv-client-details">
        {client_addr}
        {"<br>Tax ID: " + client.get('ruc', '') if client.get('ruc') else ''}
        {"<br>" + client.get('email', '') if client.get('email') else ''}
      </div>
    </div>

    <table class="inv-items-table">
      <thead>
        <tr>
          <th class="col-desc">Description</th>
          <th class="col-qty">Qty</th>
          <th class="col-price">Unit Price</th>
          <th class="col-tax">Tax</th>
          <th class="col-amount">Amount</th>
        </tr>
      </thead>
      <tbody>"""

    for item in items:
        tax_label = item.get("tax_type", "none")
        if tax_label == "tax":
            tax_label = "Tax"
        elif tax_label == "none":
            tax_label = "-"
        desc = item.get("description", "")
        is_gift = "COURTESY" in desc.upper() or "COMPLIMENTARY" in desc.upper()
        if is_gift:
            amount_html = (
                f'<span class="inv-amount-original">${fmt(item.get("amount", 0))}</span>'
                f'<span class="inv-amount-gift">Courtesy</span>'
            )
        else:
            amount_html = f'${fmt(item.get("amount", 0))}'
        html += f"""
        <tr>
          <td class="col-desc">{desc}</td>
          <td class="col-qty">{item.get('quantity', 0)}</td>
          <td class="col-price">${fmt(item.get('unit_price', 0))}</td>
          <td class="col-tax">{tax_label}</td>
          <td class="col-amount">{amount_html}</td>
        </tr>"""

    html += """
      </tbody>
    </table>"""

    # Discounts (only if section visible)
    if discounts and is_visible("discounts"):
        html += '<div class="inv-discounts">'
        for disc in discounts:
            html += f"""
        <div class="inv-discount-row">
          <span class="inv-discount-desc">{disc.get('description', '')}</span>
          <span class="inv-discount-amount">-${fmt(abs(disc.get('amount', 0)))}</span>
        </div>"""
        html += "</div>"

    # Totals
    html += f"""
    <div class="inv-totals">
      <div class="inv-totals-row">
        <span>Subtotal:</span>
        <span>${fmt(totals.get('subtotal', 0))}</span>
      </div>"""

    if totals.get("discount_total", 0) != 0:
        html += f"""
      <div class="inv-totals-row inv-discount">
        <span>Discount:</span>
        <span>-${fmt(abs(totals.get('discount_total', 0)))}</span>
      </div>"""

    html += f"""
      <div class="inv-totals-row">
        <span>{settings.get('tax_label', 'Tax')}:</span>
        <span>${fmt(totals.get('tax_amount', 0))}</span>
      </div>
      <div class="inv-totals-row inv-total-final">
        <span>Total:</span>
        <span>${fmt(totals.get('total', 0))}</span>
      </div>
    </div>"""

    # Payment (only if section visible)
    if is_visible("payment"):
        payment_title = display.get("payment_title") or "Payment Information"
        bank_line = display.get("bank_line") or (
            f"Bank: {bank.get('name', '')} | Account: {bank.get('account', '')} | Holder: {bank.get('holder', '')}"
        )

        html += f"""
    <div class="inv-payment">
      <div class="inv-payment-title">{payment_title}</div>
      <div class="inv-payment-terms">{settings.get('payment_terms', '')}</div>
      <div class="inv-payment-methods">{settings.get('payment_methods', '')}</div>
      <div class="inv-payment-bank">{bank_line}</div>"""

        # Render any additional display lines
        for key in ["extra_line1", "extra_line2"]:
            line = display.get(key, "")
            if line:
                html += f"""
      <div class="inv-payment-extra">{line}</div>"""

        html += """
    </div>"""

    # Notes (only if section visible)
    if notes and is_visible("notes"):
        notes_title = display.get("notes_title") or "Notes"
        notes_html = notes.replace("\n", "<br>")
        html += f"""
    <div class="inv-notes">
      <div class="inv-notes-title">{notes_title}</div>
      <div class="inv-notes-text">{notes_html}</div>
    </div>"""

    # Footer (only if section visible)
    if is_visible("footer"):
        footer_line1 = display.get("footer_line1") or "Thank you for your business."
        footer_line2 = display.get("footer_line2") or ""
        html += f"""
    <div class="inv-footer">
      <p>{footer_line1}</p>"""
        if footer_line2:
            html += f"""
      <p class="inv-footer-motto">{footer_line2}</p>"""
        html += """
    </div>"""

    return html


@app.post("/api/invoices/{doc_id}/pdf")
async def generate_pdf(doc_id: str):
    import asyncio

    from playwright.sync_api import sync_playwright

    doc_path = _find_doc_path(doc_id)
    if not doc_path:
        raise HTTPException(404, "Invoice not found")

    doc = json.loads(doc_path.read_text(encoding="utf-8"))
    template_html = (STATIC_DIR / "pdf-template.html").read_text(encoding="utf-8")
    css_text = (STATIC_DIR / "invoice.css").read_text(encoding="utf-8")

    invoice_html = render_invoice_html(doc)
    inv_number = doc.get("meta", {}).get("invoice_number", doc_id)

    html = template_html.replace("{{CSS}}", css_text)
    html = html.replace("{{INVOICE_CONTENT}}", invoice_html)
    html = html.replace("{{TITLE}}", f"Invoice {inv_number}")

    timestamp = datetime.now().strftime("%H%M%S")
    pdf_filename = f"{doc_id}-{timestamp}.pdf"
    pdf_path = OUTPUT_DIR / pdf_filename

    temp_html = OUTPUT_DIR / f"_temp_{doc_id}.html"
    temp_html.write_text(html, encoding="utf-8")

    def _render_pdf():
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            page.goto(f"file:///{temp_html.resolve().as_posix()}")
            page.wait_for_load_state("networkidle")
            page.pdf(
                path=str(pdf_path),
                format="Letter",
                margin={"top": "1.5cm", "bottom": "1.5cm", "left": "2cm", "right": "2cm"},
            )
            browser.close()

    try:
        await asyncio.to_thread(_render_pdf)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"PDF generation failed: {type(e).__name__}: {e}")
    finally:
        temp_html.unlink(missing_ok=True)

    return {
        "status": "generated",
        "url": f"/output/{pdf_filename}",
        "filename": pdf_filename,
    }


@app.post("/api/open-folder")
async def open_folder(request: Request):
    """Open a folder in the OS file explorer."""
    body = await request.json()
    folder = Path(body.get("path", str(OUTPUT_DIR)))
    if not folder.exists():
        folder = folder.parent
    if not folder.exists():
        raise HTTPException(404, "Folder not found")
    import subprocess
    import sys
    if sys.platform == "win32":
        subprocess.Popen(["explorer", str(folder)])
    elif sys.platform == "darwin":
        subprocess.Popen(["open", str(folder)])
    else:
        subprocess.Popen(["xdg-open", str(folder)])
    return {"status": "opened", "path": str(folder)}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("INVOICE_FORGE_PORT", "8081"))
    uvicorn.run("server:app", host="127.0.0.1", port=port, reload=True)
