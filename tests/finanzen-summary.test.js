import { describe, expect, it } from 'vitest';
import { renderSummary } from '../src/views/finanzen.js';

const SUMMARY = {
  year: 2026,
  invoiced_cents: 4400,
  paid_cents: 2400,
  open_cents: 2000,
  paid_cash_cents: 1200,
  paid_transfer_cents: 1200,
  count_open: 2,
  count_paid: 2,
  count_cancelled: 1,
};

describe('year-end summary', () => {
  it('renders German totals with cash and transfer splits', () => {
    const el = document.createElement('div');
    renderSummary(el, SUMMARY);
    const nbsp = String.fromCharCode(160);
    expect(el.textContent).toContain('Jahresübersicht 2026');
    expect(el.textContent).toContain('Fakturiert');
    expect(el.textContent).toContain(`44,00${nbsp}€`);
    expect(el.textContent).toContain('Bezahlt');
    expect(el.textContent).toContain(`24,00${nbsp}€`);
    expect(el.textContent).toContain(`davon bar: 12,00${nbsp}€`);
    expect(el.textContent).toContain(`überwiesen: 12,00${nbsp}€`);
    expect(el.textContent).toContain('Offen');
    expect(el.textContent).toContain(`20,00${nbsp}€ (2 Rechnung(en))`);
  });
});
