import { describe, expect, it, vi } from 'vitest';

const ME_KASSIER = { ok: true, json: async () => ({ ok: true, data: { user: { id: 'u-k', is_kassier: true } } }) };
const EMPTY_LIST = { ok: true, json: async () => ({ ok: true, data: { invoices: [], users: [] } }) };

function stubLoggedIn() {
  document.body.innerHTML = '<div id="header-slot"></div><main id="main-content"><div id="app-view"></div></main><div id="footer-slot"></div>';
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
    if (String(url).includes('/api/me')) return Promise.resolve(ME_KASSIER);
    return Promise.resolve(EMPTY_LIST);
  }));
}

describe('finanzen page', () => {
  it('filter change does not duplicate list and generate blocks', async () => {
    vi.resetModules();
    stubLoggedIn();
    try {
      await import('../src/pages/finanzen.js');
      await vi.waitFor(() => expect(document.querySelector('[data-generate]')).toBeTruthy());
      expect(document.querySelectorAll('[data-generate]')).toHaveLength(1);
      document.querySelector('[data-filter-status]').value = 'open';
      document.querySelector('[data-filter-status]').dispatchEvent(new Event('change', { bubbles: true }));
      await vi.waitFor(() => expect(document.querySelectorAll('[data-generate]')).toHaveLength(1));
      expect(document.querySelectorAll('[data-filter-status]')).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
      document.body.innerHTML = '';
    }
  });

  it('logged-out visit redirects to login', async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="header-slot"></div><main id="main-content"><div id="app-view"></div></main><div id="footer-slot"></div>';
    Object.defineProperty(window, 'location', { configurable: true, writable: true, value: { href: 'http://localhost/finanzen/', search: '' } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ ok: false, error: 'Please log in.' }) }));
    try {
      await import('../src/pages/finanzen.js');
      await vi.waitFor(() => expect(window.location.href).toBe('/login/'));
    } finally {
      vi.unstubAllGlobals();
      document.body.innerHTML = '';
    }
  });
});
