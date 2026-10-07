import { describe, expect, it, vi } from 'vitest';
import { renderPack } from '../src/views/versammlung.js';
import { refreshAuthLink } from '../src/layout.js';

const PACK = {
  year: 2026,
  member_count: 2,
  new_members: [{ id: 'u-2', name: 'Ben' }],
  projects: [{ id: 'p1', title: 'Shoot', start_at: '2026-06-01T18:00:00Z', member_count: 2 }],
  finance: { year: 2026, invoiced_cents: 4400, paid_cents: 2400, open_cents: 2000, paid_cash_cents: 1200, paid_transfer_cents: 1200, count_open: 2, count_paid: 2, count_cancelled: 1 },
  open_invoices: [{ id: 'i-1', user_name: 'Anna', amount_cents: 1200, reason: 'Beitrag', created_at: '2026-01-05T00:00:00Z' }],
  attendance: [{ user_id: 'u-1', present: 1 }],
};

describe('versammlung pack', () => {
  it('renders counts, names, finance lines and attendance checkboxes', () => {
    const el = document.createElement('div');
    renderPack(el, PACK, { members: [{ id: 'u-1', name: 'Anna' }, { id: 'u-2', name: 'Ben' }], onToggleAttendance: vi.fn() });
    expect(el.textContent).toContain('2');
    expect(el.textContent).toContain('Ben');
    expect(el.textContent).toContain('Shoot');
    expect(el.textContent).toContain('Fakturiert');
    const boxes = Array.from(el.querySelectorAll('[data-attendance]'));
    expect(boxes).toHaveLength(2);
    expect(boxes.find((b) => b.dataset.user === 'u-1').checked).toBe(true);
    expect(boxes.find((b) => b.dataset.user === 'u-2').checked).toBe(false);
  });

  it('toggle fires onToggleAttendance with the live checkbox state', () => {
    const el = document.createElement('div');
    const onToggleAttendance = vi.fn();
    renderPack(el, PACK, { members: [{ id: 'u-1', name: 'Anna' }], onToggleAttendance });
    const box = el.querySelector('[data-attendance]');
    box.checked = false;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onToggleAttendance).toHaveBeenCalledWith('u-1', false);
  });

  it('re-toggling the same checkbox sends the live state', () => {
    const el = document.createElement('div');
    const onToggleAttendance = vi.fn();
    renderPack(el, PACK, { members: [{ id: 'u-1', name: 'Anna' }], onToggleAttendance });
    const box = el.querySelector('[data-attendance]');
    box.checked = false;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onToggleAttendance).toHaveBeenLastCalledWith('u-1', false);
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onToggleAttendance).toHaveBeenLastCalledWith('u-1', true);
  });

  it('print button calls window.print', () => {
    const el = document.createElement('div');
    const printMock = vi.fn();
    const orig = window.print;
    window.print = printMock;
    try {
      renderPack(el, PACK, { members: [], onToggleAttendance: vi.fn() });
      el.querySelector('[data-print]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(printMock).toHaveBeenCalledTimes(1);
    } finally {
      window.print = orig;
    }
  });

  it('admin nav link shows only for admins', async () => {
    const meWith = (admin) => vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: { user: { is_admin: admin } } }) });
    document.body.innerHTML = '<a href="/versammlung/" data-private-link data-admin-link>Versammlung</a>';
    try {
      vi.stubGlobal('fetch', meWith(true));
      await refreshAuthLink();
      expect(document.querySelector('[data-admin-link]').style.display).toBe('');
      vi.stubGlobal('fetch', meWith(false));
      await refreshAuthLink();
      expect(document.querySelector('[data-admin-link]').style.display).toBe('none');
    } finally {
      vi.unstubAllGlobals();
      document.body.innerHTML = '';
    }
  });
});
