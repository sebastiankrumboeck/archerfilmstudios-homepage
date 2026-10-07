import { describe, expect, it, vi } from 'vitest';
import { renderArchive } from '../src/views/archiv.js';
import { refreshAuthLink } from '../src/layout.js';

const DOCS = [
  { id: 'doc-1', title: 'Statuten', uploaded_by: 'u-9', created_at: '2026-01-05T00:00:00Z' },
];

describe('archiv view', () => {
  window.confirm = () => true;
  it('rows show title, date and download links', () => {
    const el = document.createElement('div');
    renderArchive(el, DOCS, { onUpload: vi.fn(), onDelete: vi.fn() });
    expect(el.textContent).toContain('Statuten');
    expect(el.textContent).toContain('2026-01-05');
    expect(el.textContent).toContain('Nur für den Vorstand sichtbar.');
    const link = el.querySelector('a[href="/api/archive/doc-1/file"]');
    expect(link).toBeTruthy();
    expect(link.textContent).toContain('Herunterladen');
  });

  it('empty list states no documents yet', () => {
    const el = document.createElement('div');
    renderArchive(el, [], { onUpload: vi.fn(), onDelete: vi.fn() });
    expect(el.textContent).toContain('Noch keine Dokumente vorhanden.');
  });

  it('upload calls onUpload with title and file', async () => {
    const el = document.createElement('div');
    const onUpload = vi.fn();
    renderArchive(el, [], { onUpload, onDelete: vi.fn() });
    el.querySelector('input[name="title"]').value = 'Vertrag';
    const file = new File(['x'], 'vertrag.pdf', { type: 'application/pdf' });
    Object.defineProperty(el.querySelector('input[type="file"]'), 'files', { value: [file] });
    el.querySelector('[data-upload]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(onUpload).toHaveBeenCalledWith('Vertrag', file));
  });

  it('delete fires onDelete with the document', () => {
    const el = document.createElement('div');
    const onDelete = vi.fn();
    renderArchive(el, DOCS, { onUpload: vi.fn(), onDelete });
    el.querySelector('[data-delete]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onDelete).toHaveBeenCalledWith(DOCS[0]);
  });

  it('escapes HTML in titles', () => {
    const el = document.createElement('div');
    const evil = { id: 'doc-x', title: '<img src=x onerror=alert(1)>', uploaded_by: 'u-9', created_at: '2026-01-05T00:00:00Z' };
    renderArchive(el, [evil], { onUpload: vi.fn(), onDelete: vi.fn() });
    expect(el.querySelector('img[src="x"]')).toBeNull();
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('vorstand nav link shows for vorstand/admin only', async () => {
    const meWith = (user) => vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: { user } }) });
    document.body.innerHTML = '<a href="/archiv/" data-private-link data-vorstand-link>Archiv</a>';
    try {
      vi.stubGlobal('fetch', meWith({ is_admin: false, is_vorstand: true }));
      await refreshAuthLink();
      expect(document.querySelector('[data-vorstand-link]').style.display).toBe('');
      vi.stubGlobal('fetch', meWith({ is_admin: false, is_vorstand: false }));
      await refreshAuthLink();
      expect(document.querySelector('[data-vorstand-link]').style.display).toBe('none');
      vi.stubGlobal('fetch', meWith({ is_admin: true, is_vorstand: false }));
      await refreshAuthLink();
      expect(document.querySelector('[data-vorstand-link]').style.display).toBe('');
    } finally {
      vi.unstubAllGlobals();
      document.body.innerHTML = '';
    }
  });
});
