import { describe, expect, it, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import { renderCallSheet, renderCallSheetForm, CALL_SHEET_ROLES } from '../src/views/projects.js';

const SHEET = {
  project_id: 'p1',
  call_time: '2026-11-08T17:00:00.000Z',
  meeting_point: 'Bahnhof St. Pölten',
  schedule: '17:00 Aufbau',
  logistics: 'Parken gratis',
  emergency_contacts: 'Head 0664',
  published_at: null,
};
const ROLES = [
  { role: 'Kamera', user_id: 'u-1', user_name: 'Max' },
  { role: 'Ton', user_id: null, user_name: null },
];
const MEMBERS = [
  { id: 'u-1', name: 'Max' },
  { id: 'u-2', name: 'Mia' },
];

describe('call sheet views', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exposes the eight fixed roles', () => {
    expect(CALL_SHEET_ROLES).toEqual(['Kamera', 'Ton', 'Regie', 'Schnitt', 'Foto', 'Schauspiel', 'Organisation', 'Fahrer']);
  });

  it('renders fields, roles with names or unbesetzt, and escapes HTML', () => {
    const el = document.createElement('div');
    renderCallSheet(el, { sheet: SHEET, roles: ROLES }, {});
    expect(el.querySelector('[data-print-area]')).toBeTruthy();
    expect(el.textContent).toContain('Bahnhof St. Pölten');
    expect(el.textContent).toContain('Max');
    expect(el.textContent).toContain('unbesetzt');
    const xss = document.createElement('div');
    renderCallSheet(xss, { sheet: { ...SHEET, meeting_point: '<img src=x onerror=alert(1)>' }, roles: ROLES }, {});
    expect(xss.querySelector('img')).toBeNull();
    expect(xss.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('shows edit/publish buttons only for editors, publish only when unpublished', () => {
    const ed = document.createElement('div');
    renderCallSheet(ed, { sheet: SHEET, roles: ROLES }, { canEdit: true, onEdit: vi.fn(), onPublish: vi.fn() });
    expect(ed.querySelector('[data-edit-sheet]')).toBeTruthy();
    expect(ed.querySelector('[data-publish-sheet]')).toBeTruthy();
    const pub = document.createElement('div');
    renderCallSheet(pub, { sheet: { ...SHEET, published_at: '2026-10-12T00:00:00.000Z' }, roles: ROLES }, { canEdit: true, onEdit: vi.fn(), onPublish: vi.fn() });
    expect(pub.querySelector('[data-publish-sheet]')).toBeNull();
    const plain = document.createElement('div');
    renderCallSheet(plain, { sheet: SHEET, roles: ROLES }, {});
    expect(plain.querySelector('[data-edit-sheet]')).toBeNull();
  });

  it('print button calls window.print', () => {
    const printMock = vi.fn();
    vi.stubGlobal('print', printMock);
    const el = document.createElement('div');
    renderCallSheet(el, { sheet: SHEET, roles: ROLES }, {});
    el.querySelector('[data-print-sheet]').click();
    expect(printMock).toHaveBeenCalledTimes(1);
  });

  it('form prefills, offers members plus unbesetzt, and saves the full shape', () => {
    const el = document.createElement('div');
    const onSave = vi.fn();
    renderCallSheetForm(el, { sheet: SHEET, roles: ROLES, members: MEMBERS }, { onSave });
    expect(el.querySelector('[name="meeting_point"]').value).toBe('Bahnhof St. Pölten');
    const kameraSelect = el.querySelector('select[data-role="Kamera"]');
    expect(kameraSelect.value).toBe('u-1');
    expect([...kameraSelect.options].map((o) => o.value)).toEqual(['', 'u-1', 'u-2']);
    el.querySelector('select[data-role="Ton"]').value = 'u-2';
    el.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(onSave).toHaveBeenCalledWith({
      call_time: SHEET.call_time,
      meeting_point: 'Bahnhof St. Pölten',
      schedule: '17:00 Aufbau',
      logistics: 'Parken gratis',
      emergency_contacts: 'Head 0664',
      roles: expect.arrayContaining([
        { role: 'Kamera', user_id: 'u-1' },
        { role: 'Ton', user_id: 'u-2' },
      ]),
    });
  });

  it('form round-trips an untouched call_time without drift', () => {
    const el = document.createElement('div');
    const onSave = vi.fn();
    renderCallSheetForm(el, { sheet: SHEET, roles: [], members: [] }, { onSave });
    el.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ call_time: SHEET.call_time }));
  });

  it('print CSS scopes printed output to the sheet area', () => {
    const css = fs.readFileSync('src/input.css', 'utf8');
    const printBlock = css.match(/@media print\s*{[\s\S]*}/)?.[0] ?? '';
    expect(printBlock).toContain('data-print-area');
  });
});
