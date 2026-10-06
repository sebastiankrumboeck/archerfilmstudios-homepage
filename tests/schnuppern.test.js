import { describe, expect, it, vi } from 'vitest';
import { renderTrialForm } from '../src/views/schnuppern.js';

function fillAndSubmit(el, values) {
  const form = el.querySelector('form[data-trial-form]');
  for (const [name, value] of Object.entries(values)) {
    form.querySelector(`[name="${name}"]`).value = value;
  }
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  return form;
}

describe('schnuppern view', () => {
  it('renders name, email and note fields', () => {
    const el = document.createElement('div');
    renderTrialForm(el, { onSignup: vi.fn() });
    for (const name of ['name', 'email', 'note']) {
      expect(el.querySelector(`[name="${name}"]`)).toBeTruthy();
    }
  });

  it('submits to /api/trial-signups and shows the invite note', async () => {
    const signup = { id: 't-1', name: 'Leo', email: 'leo@example.com', note: '', created_at: '2026-10-06T12:00:00Z', contacted: 0 };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: { signup, email: { sent: true } } }) });
    vi.stubGlobal('fetch', fetchMock);
    const onSignup = vi.fn();
    try {
      const el = document.createElement('div');
      renderTrialForm(el, { onSignup });
      fillAndSubmit(el, { name: 'Leo', email: 'leo@example.com', note: '' });
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/trial-signups');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toEqual({ name: 'Leo', email: 'leo@example.com', note: '', website: '' });
      await vi.waitFor(() => expect(el.querySelector('[data-status]').textContent).toMatch(/invite/i));
      expect(onSignup).toHaveBeenCalledWith(signup);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('blocks invalid email without sending', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    try {
      const el = document.createElement('div');
      renderTrialForm(el, { onSignup: vi.fn() });
      fillAndSubmit(el, { name: 'Leo', email: 'nope', note: '' });
      await new Promise((r) => setTimeout(r, 50));
      expect(fetchMock).not.toHaveBeenCalled();
      expect(el.querySelector('[data-status]').textContent).toMatch(/valid email/i);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('shows server errors inline', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ ok: false, error: 'Please enter a valid email address.' }) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const el = document.createElement('div');
      renderTrialForm(el, { onSignup: vi.fn() });
      fillAndSubmit(el, { name: 'Leo', email: 'leo@example.com', note: '' });
      await vi.waitFor(() => expect(el.querySelector('[data-status]').textContent).toContain('Please enter a valid email address.'));
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
