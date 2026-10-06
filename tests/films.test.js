import { describe, expect, it, vi } from 'vitest';
import { renderFilmForm, renderFilms } from '../src/views/films.js';

const FILMS = [
  { id: 'f1', title: 'Night Reel', poster_r2_key: 'posters/f1-1.jpg', url: 'https://example.com/night-reel', created_at: '2026-01-01T00:00:00Z' },
  { id: 'f2', title: 'No Poster', poster_r2_key: null, url: 'https://example.com/no-poster', created_at: '2026-01-02T00:00:00Z' },
];

describe('films views', () => {
  it('poster links to the external film site in a new tab with the title below', () => {
    const el = document.createElement('div');
    renderFilms(el, FILMS, {});
    const link = el.querySelector('a[href="https://example.com/night-reel"]');
    expect(link).toBeTruthy();
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noreferrer');
    expect(link.querySelector('img[src="/posters/f1-1.jpg"]')).toBeTruthy();
    expect(el.textContent).toContain('Night Reel');
  });

  it('escapes HTML in film titles', () => {
    const el = document.createElement('div');
    renderFilms(el, [{ ...FILMS[0], title: '<img src=x onerror=alert(1)>' }], {});
    expect(el.querySelector('img[src="x"]')).toBeNull();
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('admin form collects title, url and poster', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: {} }) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const el = document.createElement('div');
      const onCreate = vi.fn();
      renderFilmForm(el, { onCreate });
      const form = el.querySelector('form');
      form.querySelector('[name="title"]').value = 'T';
      form.querySelector('[name="url"]').value = 'https://example.com/t';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/films');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toEqual({ title: 'T', url: 'https://example.com/t' });
      await vi.waitFor(() => expect(onCreate).toHaveBeenCalled());
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
