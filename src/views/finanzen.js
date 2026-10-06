import { esc } from './projects.js';
import { api } from '../api/client.js';
import { CLUB } from '../data/club.js';

export function formatEuro(cents) {
  const parts = (cents / 100).toFixed(2).split('.');
  return parts[0] + ',' + parts[1] + String.fromCharCode(160) + '€';
}

export function euroToCents(value) {
  const normalized = String(value ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN;
  return Math.round(Number(normalized) * 100);
}

const STATUS_DE = { open: 'Offen', paid: 'Bezahlt', cancelled: 'Storniert' };
const METHOD_DE = { cash: 'Bar', transfer: 'Überwiesen' };

export function renderMyInvoices(el, invoices = [], { onOpen = null } = {}) {
  el.innerHTML = '';
  if (!invoices.length) {
    el.innerHTML = '<p class="text-paper/60">Keine offenen Rechnungen.</p>';
    return;
  }
  const table = document.createElement('div');
  table.className = 'grid gap-3';
  for (const inv of invoices) {
    const row = document.createElement('button');
    row.type = 'button';
    row.setAttribute('data-open', inv.id);
    row.className = 'flex flex-wrap items-baseline gap-x-6 gap-y-1 border border-paper/15 p-4 text-left transition-colors hover:border-amber';
    row.innerHTML = `
      <span class="font-display text-xl">${esc(String(inv.year))}</span>
      <span class="flex-1">${esc(inv.reason)}</span>
      <span class="font-semibold">${esc(formatEuro(inv.amount_cents))}</span>
      <span class="text-xs uppercase tracking-widest text-paper/60">${esc(STATUS_DE[inv.status] ?? inv.status)}</span>`;
    row.addEventListener('click', () => onOpen?.(inv));
    table.append(row);
  }
  el.append(table);
}

export function renderAllInvoices(el, invoices = [], { status = '', year = '', method = '', onPay = null, onCancel = null, onOpen = null, onFilter = null } = {}) {
  el.innerHTML = '';
  const controls = document.createElement('div');
  controls.className = 'mb-4 flex flex-wrap gap-3';
  controls.innerHTML = `
    <label class="text-xs uppercase text-paper/60">Status
      <select data-filter-status class="ml-2 border border-paper/20 bg-transparent p-2 text-sm">
        ${['', 'open', 'paid', 'cancelled'].map((s) => `<option value="${s}"${status === s ? ' selected' : ''}>${s === '' ? 'Alle' : STATUS_DE[s]}</option>`).join('')}
      </select>
    </label>
    <label class="text-xs uppercase text-paper/60">Jahr
      <select data-filter-year class="ml-2 border border-paper/20 bg-transparent p-2 text-sm">
        <option value="">Alle</option>
        ${[0, 1, 2].map((d) => { const y = new Date().getFullYear() - d; return `<option value="${y}"${String(year) === String(y) ? ' selected' : ''}>${y}</option>`; }).join('')}
      </select>
    </label>
    <label class="text-xs uppercase text-paper/60">Zahlungsart
      <select data-filter-method class="ml-2 border border-paper/20 bg-transparent p-2 text-sm">
        ${['', 'cash', 'transfer'].map((m) => `<option value="${m}"${method === m ? ' selected' : ''}>${m === '' ? 'Alle' : METHOD_DE[m]}</option>`).join('')}
      </select>
    </label>`;
  const readFilters = () => ({
    status: controls.querySelector('[data-filter-status]').value,
    year: controls.querySelector('[data-filter-year]').value,
    method: controls.querySelector('[data-filter-method]').value,
  });
  for (const sel of ['[data-filter-status]', '[data-filter-year]', '[data-filter-method]']) {
    controls.querySelector(sel).addEventListener('change', () => onFilter?.(readFilters()));
  }
  el.append(controls);
  if (!invoices.length) {
    const p = document.createElement('p');
    p.className = 'text-paper/60';
    p.textContent = 'Keine Rechnungen gefunden.';
    el.append(p);
    return;
  }
  const table = document.createElement('div');
  table.className = 'grid gap-3';
  for (const inv of invoices) {
    const row = document.createElement('div');
    row.className = 'flex flex-wrap items-center gap-3 border border-paper/15 p-3 text-sm';
    row.innerHTML = `
      <button type="button" data-open class="font-semibold hover:text-amber">${esc(inv.user_name ?? inv.user_id)} — ${esc(inv.reason)} (${esc(String(inv.year))})</button>
      <span class="font-semibold">${esc(formatEuro(inv.amount_cents))}</span>
      <span class="text-xs uppercase tracking-widest text-paper/60">${esc(STATUS_DE[inv.status] ?? inv.status)}</span>
      <span class="text-xs uppercase tracking-widest text-paper/60">${esc(inv.status === 'paid' ? (METHOD_DE[inv.paid_method] ?? inv.paid_method ?? '—') : '—')}</span>
      ${inv.status === 'open' ? '<button type="button" data-pay-cash class="border border-amber px-3 py-1 text-xs uppercase">Bar bezahlt</button><button type="button" data-pay-transfer class="border border-amber px-3 py-1 text-xs uppercase">Überwiesen</button><button type="button" data-cancel class="border border-paper/20 px-3 py-1 text-xs uppercase">Stornieren</button>' : ''}`;
    row.querySelector('[data-open]')?.addEventListener('click', () => onOpen?.(inv));
    row.querySelector('[data-pay-cash]')?.addEventListener('click', () => onPay?.(inv, 'cash'));
    row.querySelector('[data-pay-transfer]')?.addEventListener('click', () => onPay?.(inv, 'transfer'));
    row.querySelector('[data-cancel]')?.addEventListener('click', () => onCancel?.(inv));
    table.append(row);
  }
  el.append(table);
}

export function renderInvoiceDetail(el, { invoice, memberName }, { canSend = false, onSend = null } = {}) {
  el.innerHTML = '';
  if (!invoice) {
    el.innerHTML = '<p class="text-red-400">Rechnung nicht gefunden.</p>';
    return;
  }
  el.innerHTML = `
    <article class="max-w-2xl border border-paper/15 p-6 sm:p-10">
      <p class="text-xs uppercase tracking-[0.22em] text-amber">Rechnung</p>
      <h2 class="mt-2 font-display text-3xl uppercase">${esc(invoice.reason)}</h2>
      <dl class="mt-6 space-y-2 text-sm">
        <div class="flex justify-between gap-4"><dt class="uppercase text-paper/60">Empfänger</dt><dd>${esc(memberName ?? invoice.user_id)}</dd></div>
        <div class="flex justify-between gap-4"><dt class="uppercase text-paper/60">Verein</dt><dd>${esc(CLUB.name)}</dd></div>
        <div class="flex justify-between gap-4"><dt class="uppercase text-paper/60">Kontoinhaber</dt><dd>${esc(CLUB.name)}</dd></div>
        <div class="flex justify-between gap-4"><dt class="uppercase text-paper/60">Betrag</dt><dd class="font-semibold">${esc(formatEuro(invoice.amount_cents))}</dd></div>
        <div class="flex justify-between gap-4"><dt class="uppercase text-paper/60">Verwendungszweck</dt><dd>${esc(invoice.year)}-${esc(invoice.user_id)}</dd></div>
        <div class="flex justify-between gap-4"><dt class="uppercase text-paper/60">Status</dt><dd>${esc(STATUS_DE[invoice.status] ?? invoice.status)}</dd></div>
      </dl>
      <p class="mt-6 text-sm text-paper/60">Bitte überweise den Betrag mit dem angegebenen Verwendungszweck. Die Bankverbindung (IBAN) erhältst du per E-Mail.</p>
      ${canSend ? '<p data-send-status class="mt-2 text-sm text-paper/60"></p><button type="button" data-send class="mt-3 w-fit border border-amber px-5 py-3 text-xs uppercase tracking-widest">Per E-Mail senden</button>' : ''}
    </article>`;
  el.querySelector('[data-send]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const status = el.querySelector('[data-send-status]');
    btn.disabled = true;
    try {
      await onSend?.(invoice);
      status.textContent = 'E-Mail gesendet ✓';
    } catch (err) {
      status.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });
}

export function renderInvoiceForm(el, { users = [], onCreate = null } = {}) {
  el.querySelector('[data-invoice-form]')?.remove();
  const year = new Date().getFullYear();
  const form = document.createElement('form');
  form.setAttribute('data-invoice-form', '');
  form.className = 'mb-8 grid max-w-2xl gap-3 border border-paper/15 p-6';
  form.innerHTML = `
    <h3 class="font-display text-xl uppercase">Rechnung erstellen</h3>
    <label class="text-xs uppercase text-paper/60">Mitglied
      <select name="user_id" required class="mt-1 w-full border border-paper/20 bg-transparent p-3 normal-case">
        <option value="">Auswählen…</option>
        ${users.map((u) => `<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('')}
      </select>
    </label>
    <label class="text-xs uppercase text-paper/60">Jahr <input name="year" type="number" min="2000" max="2100" required value="${year}" class="mt-1 w-full border border-paper/20 bg-transparent p-3" /></label>
    <label class="text-xs uppercase text-paper/60">Betrag (€) <input name="amount" required value="12.00" placeholder="12.00" class="mt-1 w-full border border-paper/20 bg-transparent p-3" /></label>
    <label class="text-xs uppercase text-paper/60">Grund <input name="reason" value="Mitgliedsbeitrag ${year}" class="mt-1 w-full border border-paper/20 bg-transparent p-3" /></label>
    <p data-error class="text-sm text-red-400"></p>
    <button class="w-fit border border-amber px-5 py-3 text-xs uppercase tracking-widest">Rechnung erstellen</button>`;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const cents = euroToCents(fd.get('amount'));
    try {
      if (!Number.isInteger(cents) || cents < 1) throw new Error('Invalid amount.');
      const data = await api('/api/invoices', {
        method: 'POST',
        body: JSON.stringify({ user_id: fd.get('user_id'), year: Number(fd.get('year')), amount_cents: cents, reason: fd.get('reason') || undefined }),
      });
      onCreate?.(data.invoice, data.email);
    } catch (err) {
      form.querySelector('[data-error]').textContent = err.message;
    }
  });
  el.prepend(form);
}

export function renderForbidden(el) {
  el.innerHTML = '<p class="text-red-400">Kassier only.</p>';
}
