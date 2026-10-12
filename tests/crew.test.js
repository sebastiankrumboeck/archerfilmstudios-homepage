import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderOpenRoles } from '../src/views/projects.js';

const ROLES = [
  { role: 'Kamera', user_id: 'u-2', user_name: 'Mia' },
  { role: 'Ton', user_id: null, user_name: null },
];
const APPS = [{ id: 'rap-1', role: 'Ton', user_id: 'u-1', user_name: 'Max', status: 'pending' }];

describe('open roles views', () => {
  afterEach(() => {
    document.querySelectorAll('[data-modal-overlay]').forEach((el) => el.remove());
  });

  it('lists open roles with Bewerben and filled roles with names only', () => {
    const el = document.createElement('div');
    renderOpenRoles(el, { roles: ROLES, applications: [] }, {});
    expect(el.textContent).toContain('Offene Rollen');
    const ton = el.querySelector('[data-apply="Ton"]');
    expect(ton).toBeTruthy();
    expect(ton.textContent).toContain('Bewerben');
    expect(el.querySelector('[data-apply="Kamera"]')).toBeNull();
    expect(el.textContent).toContain('Mia');
  });

  it('Bewerben opens a confirm modal; confirm applies, Abbrechen does not', () => {
    const el = document.createElement('div');
    const onApply = vi.fn();
    renderOpenRoles(el, { roles: ROLES, applications: [] }, { onApply });
    el.querySelector('[data-apply="Ton"]').click();
    const modal = document.querySelector('[data-modal-overlay]');
    expect(modal).toBeTruthy();
    modal.querySelector('[data-modal-cancel]').click();
    expect(document.querySelector('[data-modal-overlay]')).toBeNull();
    expect(onApply).not.toHaveBeenCalled();
    el.querySelector('[data-apply="Ton"]').click();
    document.querySelector('[data-modal-confirm]').click();
    expect(onApply).toHaveBeenCalledWith('Ton');
  });

  it('head sees applicant names with Bestätigen/Ablehnen; members see no names', () => {
    const onDecide = vi.fn();
    const head = document.createElement('div');
    renderOpenRoles(head, { roles: ROLES, applications: APPS }, { isHeadOrAdmin: true, onDecide });
    expect(head.textContent).toContain('Max');
    head.querySelector('[data-approve-app="rap-1"]').click();
    expect(onDecide).toHaveBeenCalledWith('rap-1', true);
    head.querySelector('[data-reject-app="rap-1"]').click();
    expect(onDecide).toHaveBeenCalledWith('rap-1', false);
    const plain = document.createElement('div');
    renderOpenRoles(plain, { roles: ROLES, applications: APPS }, {});
    expect(plain.textContent).not.toContain('Max');
  });

  it('shows ehemaliges Mitglied for deleted applicants', () => {
    const el = document.createElement('div');
    renderOpenRoles(el, {
      roles: ROLES,
      applications: [{ id: 'rap-9', role: 'Ton', user_id: 'u-x', user_name: null, status: 'pending' }],
    }, { isHeadOrAdmin: true, onDecide: vi.fn() });
    expect(el.textContent).toContain('ehemaliges Mitglied');
  });
});
