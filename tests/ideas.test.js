import { describe, expect, it, vi } from 'vitest';
import { renderIdeaForm, renderOwnIdeas } from '../src/views/ideen.js';

describe('ideas views', () => {
  it('form renders title/author/file inputs with PDF hint', () => {
    const el = document.createElement('div');
    renderIdeaForm(el, { onSubmit: vi.fn() });
    expect(el.querySelector('input[name="title"]')).toBeTruthy();
    expect(el.querySelector('input[name="author_name"]')).toBeTruthy();
    expect(el.querySelector('input[name="script"][type="file"]')).toBeTruthy();
    expect(el.textContent).toMatch(/40 MB/);
    expect(el.textContent).toMatch(/PDF/);
  });

  it('submit without file shows German error and does not submit', () => {
    const el = document.createElement('div');
    const onSubmit = vi.fn();
    renderIdeaForm(el, { onSubmit });
    el.querySelector('input[name="title"]').value = 'Nachtschicht';
    el.querySelector('input[name="author_name"]').value = 'Max';
    el.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(el.querySelector('[data-error]').textContent).toMatch(/PDF|Skript|Datei/);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submit with PDF calls onSubmit with title, author, and file', () => {
    const el = document.createElement('div');
    const onSubmit = vi.fn();
    renderIdeaForm(el, { onSubmit });
    el.querySelector('input[name="title"]').value = 'Nachtschicht';
    el.querySelector('input[name="author_name"]').value = 'Max';
    const file = new File(['%PDF'], 'skript.pdf', { type: 'application/pdf' });
    Object.defineProperty(el.querySelector('input[name="script"]'), 'files', { value: [file] });
    el.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(onSubmit).toHaveBeenCalledWith({ title: 'Nachtschicht', author_name: 'Max', file });
  });

  it('own list renders titles with dates and escapes HTML', () => {
    const el = document.createElement('div');
    renderOwnIdeas(el, [
      { id: 'i-1', title: 'Nachtschicht', created_at: '2026-10-12T00:00:00.000Z' },
      { id: 'i-2', title: '<img src=x onerror=alert(1)>', created_at: '2026-10-11T00:00:00.000Z' },
    ]);
    expect(el.textContent).toContain('Nachtschicht');
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
