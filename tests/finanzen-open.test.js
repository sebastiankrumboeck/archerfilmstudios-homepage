import { describe, expect, it, vi } from 'vitest';
import { renderOpenItems } from '../src/views/finanzen.js';

const OLD = { id: 'i-old', user_id: 'u-2', user_name: 'Mara', year: 2026, amount_cents: 1200, reason: 'Mitgliedsbeitrag 2026', status: 'open', created_at: '2026-01-05T00:00:00Z', paid_at: null, paid_method: null };
const NEWER = { id: 'i-new', user_id: 'u-3', user_name: 'Leo', year: 2026, amount_cents: 1200, reason: 'Mitgliedsbeitrag 2026', status: 'open', created_at: '2026-03-10T00:00:00Z', paid_at: null, paid_method: null };
const NOW = Date.parse('2026-04-01T00:00:00Z');

describe('open items', () => {
  it('sorts oldest first and shows age in days', () => {
    const el = document.createElement('div');
    renderOpenItems(el, [NEWER, OLD], { onRemind: vi.fn(), now: NOW });
    const rows = Array.from(el.querySelectorAll('[data-invoice]'));
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Mara');
    expect(rows[0].textContent).toContain('seit 86 Tagen');
    expect(rows[1].textContent).toContain('seit 22 Tagen');
    expect(el.textContent).toContain('Offene Posten');
  });

  it('remind button fires onRemind and shows success status', async () => {
    const el = document.createElement('div');
    renderOpenItems(el, [OLD], { onRemind: vi.fn().mockResolvedValue({}), now: NOW });
    el.querySelector('[data-remind]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(el.querySelector('[data-status]').textContent).toMatch(/gesendet/));
  });

  it('remind failure shows the error inline', async () => {
    const el = document.createElement('div');
    renderOpenItems(el, [OLD], { onRemind: vi.fn().mockRejectedValue(new Error('Email failed (500).')), now: NOW });
    el.querySelector('[data-remind]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(el.querySelector('[data-status]').textContent).toContain('Email failed (500).'));
  });

  it('non-open invoices are excluded', () => {
    const el = document.createElement('div');
    renderOpenItems(el, [{ ...OLD, status: 'paid' }, OLD], { onRemind: vi.fn(), now: NOW });
    expect(el.querySelectorAll('[data-invoice]')).toHaveLength(1);
  });

  it('empty list shows the all-clear note', () => {
    const el = document.createElement('div');
    renderOpenItems(el, [], { onRemind: vi.fn(), now: NOW });
    expect(el.textContent).toContain('Keine offenen Rechnungen.');
  });
});
