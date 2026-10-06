import { describe, expect, it, vi } from 'vitest';
import { renderContact } from '../src/views/contact.js';

function fillAndSubmit(el, values) {
  const form = el.querySelector('form[data-contact-form]');
  for (const [name, value] of Object.entries(values)) {
    form.querySelector(`[name="${name}"]`).value = value;
  }
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  return form;
}

describe('contact view', () => {
  it('renders name, email, subject and message fields', () => {
    const el = document.createElement('div');
    renderContact(el);
    for (const name of ['name', 'email', 'subject', 'message']) {
      expect(el.querySelector(`[name="${name}"]`)).toBeTruthy();
    }
  });

  it('submits to /api/contact and shows a thank-you note', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: { sent: true } }) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const el = document.createElement('div');
      renderContact(el);
      fillAndSubmit(el, { name: 'Jane', email: 'jane@example.com', subject: 'Hi', message: 'Hello!' });
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/contact');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toEqual({ name: 'Jane', email: 'jane@example.com', subject: 'Hi', message: 'Hello!', website: '' });
      await vi.waitFor(() => expect(el.querySelector('[data-status]').textContent).toMatch(/thank/i));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('blocks invalid email without sending', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    try {
      const el = document.createElement('div');
      renderContact(el);
      fillAndSubmit(el, { name: 'Jane', email: 'not-an-email', subject: 'Hi', message: 'Hello!' });
      await new Promise((r) => setTimeout(r, 50));
      expect(fetchMock).not.toHaveBeenCalled();
      expect(el.querySelector('[data-status]').textContent).toMatch(/valid email/i);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('shows server errors inline', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ ok: false, error: 'Email not configured.' }) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const el = document.createElement('div');
      renderContact(el);
      fillAndSubmit(el, { name: 'Jane', email: 'jane@example.com', subject: 'Hi', message: 'Hello!' });
      await vi.waitFor(() => expect(el.querySelector('[data-status]').textContent).toContain('Email not configured.'));
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
