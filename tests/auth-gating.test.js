import { describe, expect, it, vi, afterEach } from 'vitest';
import { headerHTML, refreshAuthLink } from '../src/layout.js';

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

function mount(headerActive = 'projects') {
  document.body.innerHTML = `<div id="header-slot">${headerHTML(headerActive)}</div>`;
}

describe('private navigation', () => {
  it('hides events and infos links when logged out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    mount();
    await refreshAuthLink(document);
    for (const href of ['/projects/', '/calendar/', '/board/']) {
      const link = document.querySelector(`nav a[href="${href}"]`);
      expect(link.style.display).toBe('none');
    }
    expect(document.querySelector('nav a[href="/contact/"]').style.display).not.toBe('none');
  });

  it('shows events and infos links plus logout when logged in', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: { user: { id: 'u1', name: 'Ava' } } }) }),
    );
    mount();
    await refreshAuthLink(document);
    for (const href of ['/projects/', '/calendar/', '/board/']) {
      expect(document.querySelector(`nav a[href="${href}"]`).style.display).not.toBe('none');
    }
    expect(document.body.textContent).toContain('Log out');
    expect(document.body.textContent).not.toContain('Ava');
  });

  it('logout calls the api and leaves even when the request fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    const navigated = {};
    Object.defineProperty(window, 'location', { value: navigated, writable: true, configurable: true });
    mount();
    // logged-in state first so the logout button renders
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, data: { user: { id: 'u1', name: 'Ava' } } }) });
    await refreshAuthLink(document);
    // now the request fails (offline) when clicking logout
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    document.querySelector('nav button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' })));
    await vi.waitFor(() => expect(navigated.href).toBe('/'));
  });
});
