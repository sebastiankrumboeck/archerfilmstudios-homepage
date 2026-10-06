import { describe, expect, it, vi } from 'vitest';
import { euroToCents, formatEuro, renderAllInvoices, renderForbidden, renderInvoiceDetail, renderInvoiceForm, renderMyInvoices } from '../src/views/finanzen.js';
import { refreshAuthLink } from '../src/layout.js';
import { CLUB } from '../src/data/club.js';

const INV = { id: 'i-1', user_id: 'u-2', user_name: 'Mara', year: 2026, amount_cents: 1200, reason: 'Mitgliedsbeitrag 2026', status: 'open', created_at: '2026-01-05T00:00:00Z', paid_at: null, paid_method: null };

describe('finanzen views', () => {
  it('formats Euro de-AT and parses back', () => {
    expect(formatEuro(1200)).toBe('12,00 €');
    expect(formatEuro(1250)).toBe('12,50 €');
    expect(euroToCents('12,00')).toBe(1200);
    expect(euroToCents('12')).toBe(1200);
    expect(euroToCents('12.5')).toBe(1250);
  });

  it('my invoices show year, reason, amount, status', () => {
    const el = document.createElement('div');
    const onOpen = vi.fn();
    renderMyInvoices(el, [INV], { onOpen });
    expect(el.textContent).toContain('2026');
    expect(el.textContent).toContain('Mitgliedsbeitrag 2026');
    expect(el.textContent).toContain('12,00 €');
    expect(el.textContent).toContain('Offen');
    el.querySelector('[data-open]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onOpen).toHaveBeenCalledWith(INV);
  });

  it('all invoices show member names plus status and year filters', () => {
    const el = document.createElement('div');
    renderAllInvoices(el, [INV], { onPay: vi.fn(), onCancel: vi.fn(), onOpen: vi.fn(), onFilter: vi.fn() });
    expect(el.textContent).toContain('Mara');
    expect(el.querySelector('select[data-filter-status]')).toBeTruthy();
    expect(el.querySelector('select[data-filter-year]')).toBeTruthy();
  });

  it('all invoices show the payment method plus a method filter', () => {
    const el = document.createElement('div');
    const onFilter = vi.fn();
    const paidCash = { ...INV, id: 'i-cash', status: 'paid', paid_method: 'cash' };
    const paidTransfer = { ...INV, id: 'i-tr', status: 'paid', paid_method: 'transfer' };
    renderAllInvoices(el, [paidCash, paidTransfer, INV], { onPay: vi.fn(), onCancel: vi.fn(), onOpen: vi.fn(), onFilter });
    expect(el.textContent).toContain('Bar');
    expect(el.textContent).toContain('Überwiesen');
    const methodSelect = el.querySelector('select[data-filter-method]');
    expect(methodSelect).toBeTruthy();
    methodSelect.value = 'cash';
    methodSelect.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onFilter).toHaveBeenCalledWith({ status: '', year: '', method: 'cash' });
  });

  it('pay and cancel buttons fire with the invoice', () => {
    const el = document.createElement('div');
    const onPay = vi.fn();
    const onCancel = vi.fn();
    renderAllInvoices(el, [INV], { onPay, onCancel, onOpen: vi.fn(), onFilter: vi.fn() });
    el.querySelector('[data-pay-cash]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onPay).toHaveBeenCalledWith(INV, 'cash');
    el.querySelector('[data-pay-transfer]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onPay).toHaveBeenCalledWith(INV, 'transfer');
    el.querySelector('[data-cancel]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onCancel).toHaveBeenCalledWith(INV);
  });

  it('export button fires onExport', () => {
    const el = document.createElement('div');
    const onExport = vi.fn();
    renderAllInvoices(el, [INV], { onPay: vi.fn(), onCancel: vi.fn(), onOpen: vi.fn(), onFilter: vi.fn(), onExport });
    expect(el.querySelector('[data-export]')).toBeTruthy();
    el.querySelector('[data-export]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('correct button reveals a prefilled form that submits amount and reason', async () => {
    const el = document.createElement('div');
    const onCorrect = vi.fn();
    renderAllInvoices(el, [INV], { onPay: vi.fn(), onCancel: vi.fn(), onOpen: vi.fn(), onFilter: vi.fn(), onCorrect });
    expect(el.querySelector('[data-correct-form]')).toBeNull();
    el.querySelector('[data-correct]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const form = el.querySelector('[data-correct-form]');
    expect(form).toBeTruthy();
    expect(form.querySelector('[name="reason"]').value).toBe('Mitgliedsbeitrag 2026');
    form.querySelector('[name="amount"]').value = '10.00';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(onCorrect).toHaveBeenCalledWith(INV, { amount_cents: 1000, reason: 'Mitgliedsbeitrag 2026' }));
  });

  it('invoice detail shows club, holder, amount, reason, reference, no IBAN in bundle', () => {
    const el = document.createElement('div');
    renderInvoiceDetail(el, { invoice: INV, memberName: 'Mara' });
    expect(el.textContent).toContain('Archer FilmStudios');
    expect(el.textContent).toContain(CLUB.name);
    expect(el.textContent).toContain('12,00 €');
    expect(el.textContent).toContain('Mitgliedsbeitrag 2026');
    expect(el.textContent).toContain('2026-u-2');
    expect(el.textContent).not.toContain('REPLACE_WITH_');
    expect(CLUB).not.toHaveProperty('iban');
  });

  it('invoice form prefills year, 12.00 and the template reason', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: { invoice: INV, email: { sent: false, error: 'Bank details not configured.' } } }) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const el = document.createElement('div');
      const onCreate = vi.fn();
      const users = [{ id: 'u-2', name: 'Mara' }];
      renderInvoiceForm(el, { users, onCreate });
      const form = el.querySelector('form');
      expect(form.querySelector('[name="year"]').value).toBe(String(new Date().getFullYear()));
      expect(form.querySelector('[name="amount"]').value).toBe('12.00');
      form.querySelector('[name="user_id"]').value = 'u-2';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/invoices');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toEqual({ user_id: 'u-2', year: new Date().getFullYear(), amount_cents: 1200, reason: `Mitgliedsbeitrag ${new Date().getFullYear()}` });
      await vi.waitFor(() => expect(onCreate).toHaveBeenCalled());
      expect(onCreate).toHaveBeenCalledWith(INV, { sent: false, error: 'Bank details not configured.' });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('forbidden view states Kassier only', () => {
    const el = document.createElement('div');
    renderForbidden(el);
    expect(el.textContent).toContain('Kassier only.');
  });

  it('escapes HTML in reasons and names', () => {
    const el = document.createElement('div');
    renderMyInvoices(el, [{ ...INV, reason: '<img src=x onerror=alert(1)>' }], { onOpen: vi.fn() });
    expect(el.querySelector('img[src="x"]')).toBeNull();
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('kassier nav link shows only with the flag', async () => {
    const meWith = (flag) => vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: { user: { is_kassier: flag } } }) });
    document.body.innerHTML = '<a href="/finanzen/" data-private-link data-kassier-link>Finanzen</a>';
    try {
      vi.stubGlobal('fetch', meWith(true));
      await refreshAuthLink();
      expect(document.querySelector('[data-kassier-link]').style.display).toBe('');
      vi.stubGlobal('fetch', meWith(false));
      await refreshAuthLink();
      expect(document.querySelector('[data-kassier-link]').style.display).toBe('none');
    } finally {
      vi.unstubAllGlobals();
      document.body.innerHTML = '';
    }
  });

  it('invoice detail offers resend to kassier only', () => {
    const onSend = vi.fn();
    const admin = document.createElement('div');
    renderInvoiceDetail(admin, { invoice: INV, memberName: 'Mara' }, { canSend: true, onSend });
    admin.querySelector('[data-send]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onSend).toHaveBeenCalledWith(INV);
    const plain = document.createElement('div');
    renderInvoiceDetail(plain, { invoice: INV, memberName: 'Mara' }, {});
    expect(plain.querySelector('[data-send]')).toBeNull();
  });
});
