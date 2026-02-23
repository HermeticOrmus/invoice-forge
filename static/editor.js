/**
 * Invoice Forge - Editor
 * Vanilla JS - all fields editable, section toggle, auto-save, auto-calculate.
 */

// --- State ---
let currentInvoiceId = null;
let doc = null;
let clients = [];
let saveTimeout = null;
let lastSavedJSON = '';

// --- DOM refs ---
const invoiceSelect = document.getElementById('invoiceSelect');
const btnNew = document.getElementById('btnNew');
const btnRefresh = document.getElementById('btnRefresh');
const btnPdf = document.getElementById('btnPdf');
const btnOpenFolder = document.getElementById('btnOpenFolder');
const btnTheme = document.getElementById('btnTheme');
const syncStatus = document.getElementById('syncStatus');

// Meta
const invTitle = document.getElementById('invTitle');
const invNumber = document.getElementById('invNumber');
const invDate = document.getElementById('invDate');
const invDueDate = document.getElementById('invDueDate');
const invStatus = document.getElementById('invStatus');

// Company
const companyName = document.getElementById('companyName');
const companyDetails = document.getElementById('companyDetails');

// Client
const clientSelect = document.getElementById('clientSelect');
const clientName = document.getElementById('clientName');
const clientAddr = document.getElementById('clientAddr');
const clientRuc = document.getElementById('clientRuc');
const clientEmail = document.getElementById('clientEmail');
const btnSaveClient = document.getElementById('btnSaveClient');

// Items
const itemsBody = document.getElementById('itemsBody');
const btnAddItem = document.getElementById('btnAddItem');

// Discounts
const discountsList = document.getElementById('discountsList');
const btnAddDiscount = document.getElementById('btnAddDiscount');

// Totals
const subtotalDisplay = document.getElementById('subtotalDisplay');
const discountTotalRow = document.getElementById('discountTotalRow');
const discountTotalDisplay = document.getElementById('discountTotalDisplay');
const taxLabel = document.getElementById('taxLabel');
const taxDisplay = document.getElementById('taxDisplay');
const totalDisplay = document.getElementById('totalDisplay');

// Payment
const paymentTitle = document.getElementById('paymentTitle');
const paymentTerms = document.getElementById('paymentTerms');
const paymentMethods = document.getElementById('paymentMethods');
const bankDetails = document.getElementById('bankDetails');
const extraDetails = document.getElementById('extraDetails');

// Notes
const notesTitle = document.getElementById('notesTitle');
const notesText = document.getElementById('notesText');

// Footer
const footerLine1 = document.getElementById('footerLine1');
const footerLine2 = document.getElementById('footerLine2');

// Sections
const btnSections = document.getElementById('btnSections');
const sectionsMenu = document.getElementById('sectionsMenu');

// Modal
const newInvoiceModal = document.getElementById('newInvoiceModal');
const newInvClient = document.getElementById('newInvClient');
const newInvCode = document.getElementById('newInvCode');
const btnCreateInv = document.getElementById('btnCreateInv');
const btnCancelNew = document.getElementById('btnCancelNew');


// =============================================================
// INIT
// =============================================================

async function init() {
  loadTheme();
  await loadClients();
  await loadInvoiceList();

  const hash = window.location.hash.replace('#', '');
  if (hash && invoiceSelect.querySelector(`option[value="${hash}"]`)) {
    invoiceSelect.value = hash;
  }
  if (invoiceSelect.value) {
    await loadInvoice(invoiceSelect.value);
  }

  bindEvents();
}

function bindEvents() {
  invoiceSelect.addEventListener('change', () => loadInvoice(invoiceSelect.value));
  btnNew.addEventListener('click', showNewModal);
  btnRefresh.addEventListener('click', async () => {
    await loadInvoiceList();
    if (currentInvoiceId) await loadInvoice(currentInvoiceId);
  });
  btnPdf.addEventListener('click', exportPdf);
  btnOpenFolder.addEventListener('click', openPdfFolder);
  btnTheme.addEventListener('click', toggleTheme);

  // --- Meta fields ---
  invDate.addEventListener('change', () => { doc.meta.date = invDate.value; scheduleSave(); });
  invDueDate.addEventListener('change', () => { doc.meta.due_date = invDueDate.value; scheduleSave(); });
  invStatus.addEventListener('change', () => { doc.meta.status = invStatus.value; scheduleSave(); });
  invNumber.addEventListener('input', () => {
    doc.meta.invoice_number = invNumber.textContent.trim();
    scheduleSave();
  });
  invTitle.addEventListener('input', () => {
    if (!doc.display) doc.display = {};
    doc.display.title = invTitle.textContent.trim();
    scheduleSave();
  });

  // --- Company fields (all editable) ---
  companyName.addEventListener('input', () => {
    doc.company.name = companyName.textContent.trim();
    scheduleSave();
  });
  companyDetails.addEventListener('input', () => {
    syncCompanyFromDOM();
    scheduleSave();
  });

  // --- Client fields ---
  clientSelect.addEventListener('change', onClientSelect);
  btnSaveClient.addEventListener('click', saveClientToDb);
  clientName.addEventListener('input', () => { doc.client.name = clientName.textContent.trim(); scheduleSave(); });
  clientAddr.addEventListener('input', () => { doc.client.address = clientAddr.innerText.trim(); scheduleSave(); });
  clientRuc.addEventListener('input', () => { doc.client.ruc = clientRuc.textContent.trim(); scheduleSave(); });
  clientEmail.addEventListener('input', () => { doc.client.email = clientEmail.textContent.trim(); scheduleSave(); });

  // --- Items ---
  btnAddItem.addEventListener('click', () => { addItemRow(); scheduleSave(); });

  // --- Discounts ---
  btnAddDiscount.addEventListener('click', () => { addDiscountRow(); scheduleSave(); });

  // --- Payment (all contenteditable) ---
  paymentTitle.addEventListener('input', () => {
    if (!doc.display) doc.display = {};
    doc.display.payment_title = paymentTitle.textContent.trim();
    scheduleSave();
  });
  paymentTerms.addEventListener('input', () => {
    doc.settings.payment_terms = paymentTerms.innerText.trim();
    scheduleSave();
  });
  paymentMethods.addEventListener('input', () => {
    doc.settings.payment_methods = paymentMethods.innerText.trim();
    scheduleSave();
  });
  bankDetails.addEventListener('input', () => {
    if (!doc.display) doc.display = {};
    doc.display.bank_line = bankDetails.innerText.trim();
    scheduleSave();
  });
  extraDetails.addEventListener('input', () => {
    if (!doc.display) doc.display = {};
    doc.display.extra_line1 = extraDetails.innerText.trim();
    scheduleSave();
  });

  // --- Tax label ---
  taxLabel.addEventListener('input', () => {
    doc.settings.tax_label = taxLabel.textContent.trim().replace(/:$/, '');
    scheduleSave();
  });

  // --- Notes ---
  notesTitle.addEventListener('input', () => {
    if (!doc.display) doc.display = {};
    doc.display.notes_title = notesTitle.textContent.trim();
    scheduleSave();
  });
  notesText.addEventListener('input', () => {
    doc.notes = notesText.innerText.trim();
    scheduleSave();
  });

  // --- Footer ---
  footerLine1.addEventListener('input', () => {
    if (!doc.display) doc.display = {};
    doc.display.footer_line1 = footerLine1.textContent.trim();
    scheduleSave();
  });
  footerLine2.addEventListener('input', () => {
    if (!doc.display) doc.display = {};
    doc.display.footer_line2 = footerLine2.textContent.trim();
    scheduleSave();
  });

  // --- Sections toggle ---
  btnSections.addEventListener('click', (e) => {
    e.stopPropagation();
    sectionsMenu.classList.toggle('hidden');
  });
  document.addEventListener('click', () => sectionsMenu.classList.add('hidden'));
  sectionsMenu.addEventListener('click', (e) => e.stopPropagation());

  // Section checkboxes
  sectionsMenu.querySelectorAll('input[data-section]').forEach(cb => {
    cb.addEventListener('change', () => {
      toggleSection(cb.dataset.section, cb.checked);
    });
  });

  // Section remove buttons (x on each section)
  document.querySelectorAll('.btn-section-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.hide;
      toggleSection(section, false);
      const cb = sectionsMenu.querySelector(`input[data-section="${section}"]`);
      if (cb) cb.checked = false;
    });
  });

  // --- New invoice modal ---
  btnCreateInv.addEventListener('click', createNewInvoice);
  btnCancelNew.addEventListener('click', () => newInvoiceModal.classList.add('hidden'));
  newInvClient.addEventListener('change', () => {
    const c = clients.find(cl => cl.id === newInvClient.value);
    if (c) newInvCode.value = c.code || 'INV';
  });

  // --- Keyboard: Ctrl+S ---
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      doSave();
    }
  });
}


// =============================================================
// SECTIONS TOGGLE
// =============================================================

function toggleSection(name, show) {
  const el = document.getElementById('section-' + name);
  if (!el) return;
  el.style.display = show ? '' : 'none';

  if (!doc) return;
  if (!doc.hidden_sections) doc.hidden_sections = [];
  if (show) {
    doc.hidden_sections = doc.hidden_sections.filter(s => s !== name);
  } else {
    if (!doc.hidden_sections.includes(name)) doc.hidden_sections.push(name);
  }
  scheduleSave();
}

function applySectionVisibility() {
  const hidden = (doc && doc.hidden_sections) || [];
  ['discounts', 'payment', 'notes', 'footer'].forEach(name => {
    const el = document.getElementById('section-' + name);
    const cb = sectionsMenu.querySelector(`input[data-section="${name}"]`);
    const isHidden = hidden.includes(name);
    if (el) el.style.display = isHidden ? 'none' : '';
    if (cb) cb.checked = !isHidden;
  });
}


// =============================================================
// COMPANY SYNC
// =============================================================

function syncCompanyFromDOM() {
  const text = companyDetails.innerText.trim();
  if (!doc.display) doc.display = {};
  doc.display.company_details = text;
}

function buildCompanyDetailsText(co) {
  return [
    co.address.replace(/\n/g, '\n'),
    'Tel: ' + co.phone,
    co.email,
    co.website,
  ].join('\n');
}


// =============================================================
// INVOICE LIST
// =============================================================

async function loadInvoiceList() {
  const resp = await fetch('/api/invoices');
  const list = await resp.json();
  invoiceSelect.innerHTML = '';
  if (list.length === 0) {
    invoiceSelect.innerHTML = '<option value="">No invoices</option>';
    return;
  }
  for (const inv of list) {
    const opt = document.createElement('option');
    opt.value = inv.id;
    const clientShort = inv.client_name ? ` - ${inv.client_name.substring(0, 30)}` : '';
    opt.textContent = `${inv.invoice_number}${clientShort} ($${fmt(inv.total)})`;
    invoiceSelect.appendChild(opt);
  }
}


// =============================================================
// LOAD INVOICE
// =============================================================

async function loadInvoice(id) {
  if (!id) return;
  setSyncStatus('loading');
  const resp = await fetch(`/api/invoices/${id}`);
  if (!resp.ok) { setSyncStatus('error'); return; }
  doc = await resp.json();
  currentInvoiceId = id;
  window.location.hash = id;

  if (!doc.display) doc.display = {};
  if (!doc.hidden_sections) doc.hidden_sections = [];

  lastSavedJSON = JSON.stringify(doc);
  renderInvoice();
  setSyncStatus('saved');
}

function renderInvoice() {
  if (!doc) return;
  const co = doc.company;
  const bank = co.bank || {};
  const disp = doc.display || {};

  // Meta
  invTitle.textContent = disp.title || 'INVOICE';
  invNumber.textContent = doc.meta.invoice_number;
  invDate.value = doc.meta.date || '';
  invDueDate.value = doc.meta.due_date || '';
  invStatus.value = doc.meta.status || 'draft';

  // Company
  companyName.textContent = co.name;
  const detailsText = disp.company_details || buildCompanyDetailsText(co);
  companyDetails.innerText = detailsText;

  // Client
  clientName.textContent = doc.client.name || '';
  clientAddr.innerText = doc.client.address || '';
  clientRuc.textContent = doc.client.ruc || '';
  clientEmail.textContent = doc.client.email || '';
  const matchingClient = clients.find(c => c.name === doc.client.name);
  clientSelect.value = matchingClient ? matchingClient.id : '';

  // Items
  renderItems();

  // Discounts
  renderDiscounts();

  // Totals
  recalculate();
  taxLabel.textContent = (doc.settings.tax_label || 'Tax') + ':';

  // Payment
  paymentTitle.textContent = disp.payment_title || 'Payment Information';
  paymentTerms.innerText = doc.settings.payment_terms || '';
  paymentMethods.innerText = doc.settings.payment_methods || '';
  bankDetails.innerText = disp.bank_line || `Bank: ${bank.name} | Account: ${bank.account} | Holder: ${bank.holder}`;
  extraDetails.innerText = disp.extra_line1 || '';

  // Notes
  notesTitle.textContent = disp.notes_title || 'Notes';
  notesText.innerText = doc.notes || '';

  // Footer
  footerLine1.textContent = disp.footer_line1 || 'Thank you for your business.';
  footerLine2.textContent = disp.footer_line2 || '';

  // Section visibility
  applySectionVisibility();
}


// =============================================================
// ITEMS
// =============================================================

function renderItems() {
  itemsBody.innerHTML = '';
  for (let i = 0; i < doc.items.length; i++) {
    itemsBody.appendChild(createItemRow(doc.items[i], i));
  }
}

function createItemRow(item, idx) {
  const tr = document.createElement('tr');
  tr.dataset.idx = idx;
  tr.draggable = true;

  tr.addEventListener('dragstart', (e) => {
    tr.classList.add('dragging');
    e.dataTransfer.setData('text/plain', idx.toString());
    e.dataTransfer.effectAllowed = 'move';
  });
  tr.addEventListener('dragend', () => tr.classList.remove('dragging'));
  tr.addEventListener('dragover', (e) => { e.preventDefault(); tr.classList.add('drag-over'); });
  tr.addEventListener('dragleave', () => tr.classList.remove('drag-over'));
  tr.addEventListener('drop', (e) => {
    e.preventDefault();
    tr.classList.remove('drag-over');
    const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
    const toIdx = parseInt(tr.dataset.idx);
    if (fromIdx !== toIdx) {
      const [moved] = doc.items.splice(fromIdx, 1);
      doc.items.splice(toIdx, 0, moved);
      renderItems();
      scheduleSave();
    }
  });

  // Description
  const tdDesc = document.createElement('td');
  tdDesc.className = 'col-desc';
  const descInput = document.createElement('input');
  descInput.type = 'text';
  descInput.value = item.description || '';
  descInput.placeholder = 'Item description...';
  descInput.addEventListener('input', () => { item.description = descInput.value; scheduleSave(); });
  tdDesc.appendChild(descInput);
  tr.appendChild(tdDesc);

  // Quantity
  const tdQty = document.createElement('td');
  tdQty.className = 'col-qty';
  const qtyInput = document.createElement('input');
  qtyInput.type = 'number';
  qtyInput.min = '0';
  qtyInput.step = '1';
  qtyInput.value = item.quantity || 0;
  qtyInput.addEventListener('input', () => {
    item.quantity = parseFloat(qtyInput.value) || 0;
    item.amount = round(item.quantity * item.unit_price);
    amountSpan.textContent = '$' + fmt(item.amount);
    recalculate();
    scheduleSave();
  });
  tdQty.appendChild(qtyInput);
  tr.appendChild(tdQty);

  // Unit Price
  const tdPrice = document.createElement('td');
  tdPrice.className = 'col-price';
  const priceInput = document.createElement('input');
  priceInput.type = 'number';
  priceInput.min = '0';
  priceInput.step = '0.01';
  priceInput.value = item.unit_price || 0;
  priceInput.addEventListener('input', () => {
    item.unit_price = parseFloat(priceInput.value) || 0;
    item.amount = round(item.quantity * item.unit_price);
    amountSpan.textContent = '$' + fmt(item.amount);
    recalculate();
    scheduleSave();
  });
  tdPrice.appendChild(priceInput);
  tr.appendChild(tdPrice);

  // Tax Type
  const tdTax = document.createElement('td');
  tdTax.className = 'col-tax';
  const taxSelect = document.createElement('select');
  taxSelect.innerHTML = '<option value="tax">Tax</option><option value="none">-</option>';
  taxSelect.value = item.tax_type || 'tax';
  taxSelect.addEventListener('change', () => { item.tax_type = taxSelect.value; recalculate(); scheduleSave(); });
  tdTax.appendChild(taxSelect);
  tr.appendChild(tdTax);

  // Amount
  const tdAmount = document.createElement('td');
  tdAmount.className = 'col-amount';
  const amountSpan = document.createElement('span');
  amountSpan.textContent = '$' + fmt(item.amount || 0);
  tdAmount.appendChild(amountSpan);
  tr.appendChild(tdAmount);

  // Delete
  const tdActions = document.createElement('td');
  tdActions.className = 'col-actions';
  const btnDel = document.createElement('button');
  btnDel.className = 'btn-remove-row';
  btnDel.textContent = '\u00d7';
  btnDel.title = 'Remove';
  btnDel.addEventListener('click', () => {
    doc.items.splice(idx, 1);
    renderItems();
    recalculate();
    scheduleSave();
  });
  tdActions.appendChild(btnDel);
  tr.appendChild(tdActions);

  return tr;
}

function addItemRow(itemData) {
  const newItem = itemData || {
    id: 'li' + String(doc.items.length + 1).padStart(3, '0'),
    description: '',
    quantity: 1,
    unit_price: 0,
    tax_type: 'tax',
    amount: 0,
  };
  doc.items.push(newItem);
  renderItems();
  recalculate();
  const rows = itemsBody.querySelectorAll('tr');
  const lastRow = rows[rows.length - 1];
  if (lastRow) {
    const descInput = lastRow.querySelector('.col-desc input');
    if (descInput) descInput.focus();
  }
}


// =============================================================
// DISCOUNTS
// =============================================================

function renderDiscounts() {
  discountsList.innerHTML = '';
  if (!doc.discounts) doc.discounts = [];
  for (let i = 0; i < doc.discounts.length; i++) {
    discountsList.appendChild(createDiscountRow(doc.discounts[i], i));
  }
}

function createDiscountRow(disc, idx) {
  const row = document.createElement('div');
  row.className = 'discount-row';

  const descInput = document.createElement('input');
  descInput.className = 'disc-desc';
  descInput.type = 'text';
  descInput.value = disc.description || '';
  descInput.placeholder = 'Discount description...';
  descInput.addEventListener('input', () => { disc.description = descInput.value; scheduleSave(); });
  row.appendChild(descInput);

  const typeSelect = document.createElement('select');
  typeSelect.className = 'disc-type';
  typeSelect.innerHTML = '<option value="percentage">Percentage %</option><option value="fixed">Fixed Amount $</option>';
  typeSelect.value = disc.type || 'percentage';
  typeSelect.addEventListener('change', () => {
    disc.type = typeSelect.value;
    recalculateDiscount(disc, amountSpan);
    recalculate();
    scheduleSave();
  });
  row.appendChild(typeSelect);

  const valueInput = document.createElement('input');
  valueInput.className = 'disc-value';
  valueInput.type = 'number';
  valueInput.min = '0';
  valueInput.step = '0.01';
  valueInput.value = disc.value || 0;
  valueInput.addEventListener('input', () => {
    disc.value = parseFloat(valueInput.value) || 0;
    recalculateDiscount(disc, amountSpan);
    recalculate();
    scheduleSave();
  });
  row.appendChild(valueInput);

  const amountSpan = document.createElement('span');
  amountSpan.className = 'disc-amount';
  amountSpan.textContent = '-$' + fmt(Math.abs(disc.amount || 0));
  row.appendChild(amountSpan);

  const btnDel = document.createElement('button');
  btnDel.className = 'btn-remove-row';
  btnDel.textContent = '\u00d7';
  btnDel.addEventListener('click', () => {
    doc.discounts.splice(idx, 1);
    renderDiscounts();
    recalculate();
    scheduleSave();
  });
  row.appendChild(btnDel);

  return row;
}

function recalculateDiscount(disc, amountSpan) {
  const subtotal = doc.items.reduce((sum, it) => sum + (it.amount || 0), 0);
  if (disc.type === 'percentage') {
    disc.amount = -round(subtotal * (disc.value / 100));
  } else {
    disc.amount = -round(disc.value);
  }
  amountSpan.textContent = '-$' + fmt(Math.abs(disc.amount));
}

function addDiscountRow() {
  const disc = {
    id: 'd' + String((doc.discounts || []).length + 1).padStart(3, '0'),
    description: '',
    type: 'percentage',
    value: 0,
    amount: 0,
  };
  doc.discounts.push(disc);
  renderDiscounts();
  recalculate();
  const rows = discountsList.querySelectorAll('.discount-row');
  const lastRow = rows[rows.length - 1];
  if (lastRow) lastRow.querySelector('.disc-desc')?.focus();
}


// =============================================================
// CALCULATIONS
// =============================================================

function recalculate() {
  if (!doc) return;
  const taxRate = doc.settings.tax_rate || 0;
  const subtotal = doc.items.reduce((sum, it) => sum + (it.amount || 0), 0);

  let discountTotal = 0;
  for (const disc of (doc.discounts || [])) {
    if (disc.type === 'percentage') {
      disc.amount = -round(subtotal * (disc.value / 100));
    } else {
      disc.amount = -round(disc.value);
    }
    discountTotal += Math.abs(disc.amount);
  }

  const taxableSubtotal = doc.items
    .filter(it => it.tax_type === 'tax')
    .reduce((sum, it) => sum + (it.amount || 0), 0);
  const taxableRatio = subtotal > 0 ? taxableSubtotal / subtotal : 0;
  const taxableAfterDiscount = taxableSubtotal - (discountTotal * taxableRatio);
  const taxAmount = round(Math.max(0, taxableAfterDiscount) * taxRate);
  const total = round(subtotal - discountTotal + taxAmount);

  doc.totals = {
    subtotal: round(subtotal),
    discount_total: round(discountTotal),
    tax_amount: taxAmount,
    total: total,
  };

  subtotalDisplay.textContent = '$' + fmt(subtotal);
  if (discountTotal > 0) {
    discountTotalRow.style.display = '';
    discountTotalDisplay.textContent = '-$' + fmt(discountTotal);
  } else {
    discountTotalRow.style.display = 'none';
  }
  taxDisplay.textContent = '$' + fmt(taxAmount);
  totalDisplay.textContent = '$' + fmt(total);
}


// =============================================================
// CLIENTS
// =============================================================

async function loadClients() {
  const resp = await fetch('/api/clients');
  const data = await resp.json();
  clients = data.clients || [];
  populateClientSelect(clientSelect);
  populateClientSelect(newInvClient);
}

function populateClientSelect(select) {
  select.innerHTML = '<option value="">-- Select client --</option>';
  for (const c of clients) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    select.appendChild(opt);
  }
}

function onClientSelect() {
  const c = clients.find(cl => cl.id === clientSelect.value);
  if (!c) return;
  doc.client = { name: c.name, address: c.address, ruc: c.ruc, email: c.email };
  clientName.textContent = c.name;
  clientAddr.innerText = c.address;
  clientRuc.textContent = c.ruc;
  clientEmail.textContent = c.email;
  if (c.default_terms) {
    doc.settings.payment_terms = c.default_terms;
    paymentTerms.innerText = doc.settings.payment_terms;
  }
  scheduleSave();
}

async function saveClientToDb() {
  const name = doc.client.name;
  if (!name) return;
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const existing = clients.find(c => c.id === id);
  const clientData = {
    id, code: existing ? existing.code : 'INV',
    name: doc.client.name, address: doc.client.address,
    ruc: doc.client.ruc, email: doc.client.email,
    default_tax: 'tax', default_terms: doc.settings.payment_terms || 'Net 30',
  };
  if (existing) Object.assign(existing, clientData);
  else clients.push(clientData);

  await fetch('/api/clients', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clients }),
  });
  populateClientSelect(clientSelect);
  populateClientSelect(newInvClient);
  clientSelect.value = id;
  setSyncStatus('saved');
}


// =============================================================
// NEW INVOICE
// =============================================================

function showNewModal() {
  populateClientSelect(newInvClient);
  newInvCode.value = 'INV';
  newInvoiceModal.classList.remove('hidden');
}

async function createNewInvoice() {
  const clientId = newInvClient.value;
  const clientCode = newInvCode.value || 'INV';
  const client = clients.find(c => c.id === clientId);
  const body = {
    client_code: clientCode,
    client: client ? { name: client.name, address: client.address, ruc: client.ruc, email: client.email } : undefined,
    payment_terms: client ? client.default_terms : 'Net 30',
  };
  const resp = await fetch('/api/invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await resp.json();
  newInvoiceModal.classList.add('hidden');
  await loadInvoiceList();
  invoiceSelect.value = result.id;
  await loadInvoice(result.id);
}


// =============================================================
// PDF EXPORT
// =============================================================

let lastPdfFolder = null;

async function exportPdf() {
  if (!currentInvoiceId) return;
  setSyncStatus('saving');
  await doSave();
  setSyncStatus('generating PDF...');
  const resp = await fetch(`/api/invoices/${currentInvoiceId}/pdf`, { method: 'POST' });
  if (!resp.ok) { setSyncStatus('error'); return; }
  const result = await resp.json();
  setSyncStatus('saved');
  window.open(result.url, '_blank');
}

async function openPdfFolder() {
  if (!lastPdfFolder) return;
  await fetch('/api/open-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: lastPdfFolder })
  });
}


// =============================================================
// AUTO-SAVE
// =============================================================

function scheduleSave() {
  setSyncStatus('saving');
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(doSave, 500);
}

async function doSave() {
  if (!doc || !currentInvoiceId) return;
  const json = JSON.stringify(doc);
  if (json === lastSavedJSON) { setSyncStatus('saved'); return; }
  try {
    await fetch(`/api/invoices/${currentInvoiceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: json,
    });
    lastSavedJSON = json;
    setSyncStatus('saved');
  } catch (err) {
    setSyncStatus('error');
    console.error('Save failed:', err);
  }
}

function setSyncStatus(status) {
  syncStatus.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  syncStatus.className = 'sync-status';
  if (status === 'saving' || status === 'generating PDF...') syncStatus.classList.add('saving');
  else if (status === 'saved') syncStatus.classList.add('saved');
  else if (status === 'error') syncStatus.classList.add('error');
}


// =============================================================
// THEME
// =============================================================

function loadTheme() {
  const saved = localStorage.getItem('invoiceEditorTheme');
  if (saved === 'light') document.documentElement.setAttribute('data-theme', 'light');
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  if (current === 'light') {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('invoiceEditorTheme', 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('invoiceEditorTheme', 'light');
  }
}


// =============================================================
// UTILS
// =============================================================

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function round(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}


// =============================================================
// BOOT
// =============================================================

init();
