import { describe, expect, it, vi } from 'vitest';
import { renderDecisions } from '../src/views/beschluesse.js';

const DECISIONS = [
  { id: 'd-1', title: 'Beitrag fix', detail: '12 € ab 2027', decided_at: '2026-09-01', recorded_by: 'u-admin', created_at: '2026-09-02T00:00:00Z' },
  { id: 'd-2', title: 'Neuer Raum', detail: '', decided_at: '2026-10-01', recorded_by: 'u-admin', created_at: '2026-10-02T00:00:00Z' },
];

describe('beschluesse view', () => {
  window.confirm = () => true;
  it('rows show title, date and detail', () => {
    const el = document.createElement('div');
    renderDecisions(el, DECISIONS, { canManage: false, onAdd: vi.fn(), onDelete: vi.fn() });
    expect(el.textContent).toContain('Beitrag fix');
    expect(el.textContent).toContain('2026-09-01');
    expect(el.textContent).toContain('12 € ab 2027');
    expect(el.textContent).toContain('Beschlüsse');
  });

  it('empty list states no decisions yet', () => {
    const el = document.createElement('div');
    renderDecisions(el, [], { canManage: false, onAdd: vi.fn(), onDelete: vi.fn() });
    expect(el.textContent).toContain('Noch keine Beschlüsse vorhanden.');
  });

  it('add form only renders when allowed and submits the payload', async () => {
    const el = document.createElement('div');
    const onAdd = vi.fn();
    renderDecisions(el, [], { canManage: true, onAdd, onDelete: vi.fn() });
    const form = el.querySelector('[data-decision-form]');
    expect(form).toBeTruthy();
    form.querySelector('[name="title"]').value = 'Neuer Raum';
    form.querySelector('[name="detail"]').value = 'Ab November';
    form.querySelector('[name="decided_at"]').value = '2026-10-15';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(onAdd).toHaveBeenCalledWith({ title: 'Neuer Raum', detail: 'Ab November', decided_at: '2026-10-15' }));
    const plain = document.createElement('div');
    renderDecisions(plain, [], { canManage: false, onAdd: vi.fn(), onDelete: vi.fn() });
    expect(plain.querySelector('[data-decision-form]')).toBeNull();
  });

  it('delete button only renders when allowed and fires onDelete with the decision', () => {
    const el = document.createElement('div');
    const onDelete = vi.fn();
    renderDecisions(el, [DECISIONS[0]], { canManage: true, onAdd: vi.fn(), onDelete });
    el.querySelector('[data-delete]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onDelete).toHaveBeenCalledWith(DECISIONS[0]);
    const plain = document.createElement('div');
    renderDecisions(plain, [DECISIONS[0]], { canManage: false, onAdd: vi.fn(), onDelete: vi.fn() });
    expect(plain.querySelector('[data-delete]')).toBeNull();
  });

  it('escapes HTML in titles and details', () => {
    const el = document.createElement('div');
    const evil = { id: 'd-x', title: '<img src=x onerror=alert(1)>', detail: '<script>alert(2)</script>', decided_at: '2026-10-01', recorded_by: 'u-1', created_at: '2026-10-02T00:00:00Z' };
    renderDecisions(el, [evil], { canManage: false, onAdd: vi.fn(), onDelete: vi.fn() });
    expect(el.querySelector('img[src="x"]')).toBeNull();
    expect(el.querySelector('script')).toBeNull();
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
