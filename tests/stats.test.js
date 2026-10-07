import { describe, expect, it } from 'vitest';
import { renderStats } from '../src/views/stats.js';

const STATS = {
  total_members: 3,
  new_this_year: 1,
  projects_this_year: 2,
  participations_this_year: 3,
  joins_by_year: [{ year: 2024, count: 1 }, { year: 2026, count: 2 }],
  inactive: [
    { id: 'u-2', name: 'Ben', last_active: 'nie' },
    { id: 'u-3', name: 'Cid', last_active: '2025-09-01' },
  ],
};

describe('stats view', () => {
  it('renders totals, year bars and inactive list', () => {
    const el = document.createElement('div');
    renderStats(el, STATS);
    expect(el.textContent).toContain('Statistiken');
    expect(el.textContent).toContain('3');
    expect(el.textContent).toContain('Beitritte pro Jahr');
    expect(el.textContent).toContain('2026');
    expect(el.textContent).toContain('Länger nicht dabei');
    expect(el.textContent).toContain('Ben');
    expect(el.textContent).toContain('nie');
    const bars = el.querySelectorAll('[data-year-bar]');
    expect(bars.length).toBe(2);
  });

  it('escapes HTML in member names', () => {
    const el = document.createElement('div');
    renderStats(el, { ...STATS, inactive: [{ id: 'u-x', name: '<img src=x onerror=alert(1)>', last_active: 'nie' }] });
    expect(el.querySelector('img[src="x"]')).toBeNull();
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
