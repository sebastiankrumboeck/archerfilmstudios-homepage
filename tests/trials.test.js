import { describe, expect, it, vi } from 'vitest';
import { renderTrialList } from '../src/views/trials.js';

const SIGNUPS = [
  { id: 't-1', name: 'Leo Gast', email: 'leo@example.com', note: 'Komme gern vorbei!', created_at: '2026-10-06T12:00:00Z', contacted: 0 },
  { id: 't-2', name: 'Mia Neu', email: 'mia@example.com', note: '', created_at: '2026-10-05T12:00:00Z', contacted: 1 },
];

describe('trial list', () => {
  it('rows show name, mailto email, note and date', () => {
    const el = document.createElement('div');
    renderTrialList(el, SIGNUPS, { onContacted: vi.fn() });
    expect(el.textContent).toContain('Leo Gast');
    expect(el.querySelector('a[href="mailto:leo@example.com"]')).toBeTruthy();
    expect(el.textContent).toContain('Komme gern vorbei!');
    expect(el.textContent).toContain('2026-10-06');
  });

  it('empty list states no trial signups', () => {
    const el = document.createElement('div');
    renderTrialList(el, [], { onContacted: vi.fn() });
    expect(el.textContent).toContain('No trial signups yet.');
  });

  it('contacted toggle fires onContacted with flipped flag', () => {
    const el = document.createElement('div');
    const onContacted = vi.fn();
    renderTrialList(el, SIGNUPS, { onContacted });
    const rows = Array.from(el.querySelectorAll('[data-signup]'));
    rows[0].querySelector('[data-toggle]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onContacted).toHaveBeenCalledWith(SIGNUPS[0], { contacted: 1 });
    rows[1].querySelector('[data-toggle]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onContacted).toHaveBeenCalledWith(SIGNUPS[1], { contacted: 0 });
  });

  it('escapes HTML in names and notes', () => {
    const el = document.createElement('div');
    const evil = { id: 't-x', name: '<img src=x onerror=alert(1)>', email: 'e@x.at', note: '<script>alert(2)</script>', created_at: '2026-10-06T12:00:00Z', contacted: 0 };
    renderTrialList(el, [evil], { onContacted: vi.fn() });
    expect(el.querySelector('img[src="x"]')).toBeNull();
    expect(el.querySelector('script')).toBeNull();
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
