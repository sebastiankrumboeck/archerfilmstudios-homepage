import { describe, expect, it, vi } from 'vitest';
import { renderMinutes } from '../src/views/mitschriften.js';

const DOCS = [
  { id: 'min-1', title: 'Sitzung Oktober', uploaded_by: 'u-7', created_at: '2026-10-05T00:00:00Z' },
  { id: 'min-2', title: 'Sitzung September', uploaded_by: 'u-7', created_at: '2026-09-05T00:00:00Z' },
];

describe('mitschriften view', () => {
  window.confirm = () => true;
  it('rows show title, date and view links', () => {
    const el = document.createElement('div');
    renderMinutes(el, DOCS, { canUpload: false, canDeleteFor: () => false, onUpload: vi.fn(), onDelete: vi.fn() });
    expect(el.textContent).toContain('Sitzung Oktober');
    expect(el.textContent).toContain('2026-10-05');
    const link = el.querySelector('a[href="/api/minutes/min-1/file"]');
    expect(link).toBeTruthy();
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('empty list states no minutes yet', () => {
    const el = document.createElement('div');
    renderMinutes(el, [], { canUpload: false, canDeleteFor: () => false, onUpload: vi.fn(), onDelete: vi.fn() });
    expect(el.textContent).toContain('Noch keine Mitschriften');
  });

  it('upload form only renders when allowed, with the PDF export hint', () => {
    const el = document.createElement('div');
    renderMinutes(el, DOCS, { canUpload: true, canDeleteFor: () => false, onUpload: vi.fn(), onDelete: vi.fn() });
    expect(el.querySelector('input[name="title"]')).toBeTruthy();
    expect(el.querySelector('input[type="file"]')).toBeTruthy();
    expect(el.textContent).toContain('Als PDF exportieren');
    const plain = document.createElement('div');
    renderMinutes(plain, DOCS, { canUpload: false, canDeleteFor: () => false, onUpload: vi.fn(), onDelete: vi.fn() });
    expect(plain.querySelector('input[type="file"]')).toBeNull();
  });

  it('upload calls onUpload with title and file', async () => {
    const el = document.createElement('div');
    const onUpload = vi.fn();
    renderMinutes(el, [], { canUpload: true, canDeleteFor: () => false, onUpload, onDelete: vi.fn() });
    el.querySelector('input[name="title"]').value = 'Sitzung November';
    const file = new File(['%PDF'], 'sitzung.pdf', { type: 'application/pdf' });
    Object.defineProperty(el.querySelector('input[type="file"]'), 'files', { value: [file] });
    el.querySelector('[data-upload]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(onUpload).toHaveBeenCalledWith('Sitzung November', file));
  });

  it('delete button fires onDelete with the minute', () => {
    const el = document.createElement('div');
    const onDelete = vi.fn();
    renderMinutes(el, [DOCS[0]], { canUpload: false, canDeleteFor: () => true, onUpload: vi.fn(), onDelete });
    el.querySelector('[data-delete]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onDelete).toHaveBeenCalledWith(DOCS[0]);
  });

  it('escapes HTML in titles', () => {
    const el = document.createElement('div');
    const evil = { id: 'min-x', title: '<img src=x onerror=alert(1)>', uploaded_by: 'u-7', created_at: '2026-10-05T00:00:00Z' };
    renderMinutes(el, [evil], { canUpload: false, canDeleteFor: () => false, onUpload: vi.fn(), onDelete: vi.fn() });
    expect(el.querySelector('img[src="x"]')).toBeNull();
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
