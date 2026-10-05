import { describe, expect, it, vi } from 'vitest';
import { renderVorstand } from '../src/views/vorstand.js';

const USERS = [
  { id: 'u1', name: 'Ava', function: 'Kamera', avatar_r2_key: 'avatars/u1-1.jpg', is_admin: true, is_vorstand: true, vorstand_title: 'Regie' },
  { id: 'u2', name: 'Ben', function: 'Ton', avatar_r2_key: null, is_admin: false, is_vorstand: false, vorstand_title: null },
];

describe('vorstand view', () => {
  it('renders only vorstand members with photo, title and function', () => {
    const el = document.createElement('div');
    renderVorstand(el, USERS, {});
    expect(el.textContent).toContain('Ava');
    expect(el.textContent).toContain('Regie');
    expect(el.textContent).not.toContain('Ben');
    expect(el.querySelector('img')?.getAttribute('src')).toBe('/avatars/u1-1.jpg');
  });

  it('admin controls add a member with title', () => {
    const el = document.createElement('div');
    const onVorstand = vi.fn();
    renderVorstand(el, USERS, { isAdmin: true, onVorstand });
    const row = Array.from(el.querySelectorAll('[data-user]')).find((r) => r.textContent.includes('Ben'));
    row.querySelector('[data-title]').value = 'Schnitt';
    row.querySelector('[data-add]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onVorstand).toHaveBeenCalledWith(USERS[1], { is_vorstand: true, vorstand_title: 'Schnitt' });
  });

  it('admin controls remove a vorstand member', () => {
    const el = document.createElement('div');
    const onVorstand = vi.fn();
    renderVorstand(el, USERS, { isAdmin: true, onVorstand });
    const row = Array.from(el.querySelectorAll('[data-user]')).find((r) => r.textContent.includes('Ava'));
    row.querySelector('[data-remove]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onVorstand).toHaveBeenCalledWith(USERS[0], { is_vorstand: false, vorstand_title: null });
  });

  it('admin photo input fires onPhoto with user and file', () => {
    const el = document.createElement('div');
    const onPhoto = vi.fn();
    renderVorstand(el, USERS, { isAdmin: true, onPhoto });
    const row = Array.from(el.querySelectorAll('[data-user]')).find((r) => r.textContent.includes('Ava'));
    const file = new File(['x'], 'ig.jpg', { type: 'image/jpeg' });
    const input = row.querySelector('[data-photo]');
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onPhoto).toHaveBeenCalledWith(USERS[0], file);
  });
});
