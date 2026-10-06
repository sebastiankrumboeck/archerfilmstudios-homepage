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

  it('selecting a file does not upload and keeps the file available', () => {
    const el = document.createElement('div');
    const onPhoto = vi.fn();
    renderVorstand(el, USERS, { isAdmin: true, onPhoto });
    const row = Array.from(el.querySelectorAll('[data-user]')).find((r) => r.textContent.includes('Ava'));
    const file = new File(['x'], 'ig.jpg', { type: 'image/jpeg' });
    const input = row.querySelector('[data-photo]');
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onPhoto).not.toHaveBeenCalled();
    expect(input.files[0]).toBe(file);
    expect(row.querySelector('[data-photo-status]').textContent).toContain('ig.jpg');
  });

  it('renders the six static vorstand cards when no members match', () => {
    const el = document.createElement('div');
    renderVorstand(el, [], {});
    for (const name of ['Sebastian Krumböck', 'Maja Höllerer', 'Klemens Ruhrhofer', 'Lucia Mickova', 'Simon Kranawetter', 'Alexander Ebner']) {
      expect(el.textContent).toContain(name);
    }
    expect(el.textContent).toContain('Obmann Stellvertreterin');
    expect(el.textContent).toContain('Schriftführer Stellvertreter');
  });

  it('static card stays until explicitly linked, even on name match', () => {
    const el = document.createElement('div');
    const users = [{ id: 'u9', name: 'maja höllerer', function: '', avatar_r2_key: null, is_admin: false, is_vorstand: true, vorstand_title: 'Obmann Stellvertreterin' }];
    renderVorstand(el, users, { links: {} });
    expect(el.textContent).toContain('Maja Höllerer');
    const linked = document.createElement('div');
    renderVorstand(linked, users, { links: { 'obmann-stellvertreterin': 'u9' } });
    expect(linked.textContent).not.toContain('Maja Höllerer');
    expect(linked.textContent).toContain('maja höllerer');
  });

  it('admin rename fires onRename with edited name and function', () => {
    const el = document.createElement('div');
    const onRename = vi.fn();
    renderVorstand(el, USERS, { isAdmin: true, onRename });
    const row = Array.from(el.querySelectorAll('[data-user]')).find((r) => r.textContent.includes('Ben'));
    row.querySelector('[data-name]').value = 'Benedikt';
    row.querySelector('[data-function]').value = 'Licht';
    row.querySelector('[data-save]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onRename).toHaveBeenCalledWith(USERS[1], { name: 'Benedikt', function: 'Licht' });
  });

  it('admin toggle fires onAdmin to promote and demote', () => {
    const el = document.createElement('div');
    const onAdmin = vi.fn();
    renderVorstand(el, USERS, { isAdmin: true, onAdmin });
    const rows = Array.from(el.querySelectorAll('[data-user]'));
    rows.find((r) => r.textContent.includes('Ben')).querySelector('[data-promote]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onAdmin).toHaveBeenCalledWith(USERS[1], { is_admin: true });
    rows.find((r) => r.textContent.includes('Ava')).querySelector('[data-demote]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onAdmin).toHaveBeenCalledWith(USERS[0], { is_admin: false });
  });

  it('linked slot renders the user account instead of the static card', () => {
    const el = document.createElement('div');
    const klemens = { id: 'u-9', name: 'Klemens', function: 'Kamera', avatar_r2_key: 'avatars/u-9-1.jpg', is_admin: false, is_vorstand: true, vorstand_title: 'Kassier' };
    renderVorstand(el, [klemens], { links: { kassier: 'u-9' } });
    expect(el.querySelector('img[src="/avatars/u-9-1.jpg"]')).toBeTruthy();
    expect(el.textContent).toContain('Klemens');
    expect(el.textContent).not.toContain('Klemens Ruhrhofer');
    expect(el.querySelector('a[href="/members/?id=u-9"]')).toBeTruthy();
  });

  it('unlinked static card offers link UI to admins only', () => {
    const admin = document.createElement('div');
    renderVorstand(admin, [USERS[1]], { isAdmin: true, links: {} });
    const select = admin.querySelector('select[data-link]');
    expect(select).toBeTruthy();
    expect([...select.options].some((o) => o.value === 'u2')).toBe(true);
    const plain = document.createElement('div');
    renderVorstand(plain, [USERS[1]], { links: {} });
    expect(plain.querySelector('select[data-link]')).toBeNull();
  });

  it('upload button fires onPhoto with the selected file and shows status', async () => {
    const el = document.createElement('div');
    const onPhoto = vi.fn().mockResolvedValue(undefined);
    renderVorstand(el, USERS, { isAdmin: true, onPhoto });
    const row = Array.from(el.querySelectorAll('[data-user]')).find((r) => r.textContent.includes('Ben'));
    const file = new File(['x'], 'pic.jpg', { type: 'image/jpeg' });
    Object.defineProperty(row.querySelector('[data-photo]'), 'files', { value: [file] });
    row.querySelector('[data-upload]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(onPhoto).toHaveBeenCalledWith(USERS[1], file));
    expect(row.querySelector('[data-photo-status]').textContent).toMatch(/saved/i);
    expect(row.querySelector('[data-photo]').value).toBe('');
  });

  it('failed upload keeps the file and shows the error', async () => {
    const el = document.createElement('div');
    const onPhoto = vi.fn().mockRejectedValue(new Error('Nope'));
    renderVorstand(el, USERS, { isAdmin: true, onPhoto });
    const row = Array.from(el.querySelectorAll('[data-user]')).find((r) => r.textContent.includes('Ben'));
    const file = new File(['x'], 'pic.jpg', { type: 'image/jpeg' });
    const input = row.querySelector('[data-photo]');
    Object.defineProperty(input, 'files', { value: [file] });
    row.querySelector('[data-upload]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(row.querySelector('[data-photo-status]').textContent).toBe('Nope'));
    expect(input.files[0]).toBe(file);
  });

  it('upload without a file shows a hint and skips onPhoto', () => {
    const el = document.createElement('div');
    const onPhoto = vi.fn();
    renderVorstand(el, USERS, { isAdmin: true, onPhoto });
    const row = Array.from(el.querySelectorAll('[data-user]')).find((r) => r.textContent.includes('Ben'));
    row.querySelector('[data-upload]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onPhoto).not.toHaveBeenCalled();
    expect(row.querySelector('[data-photo-status]').textContent).toMatch(/choose a file/i);
  });

  it('kassier toggle fires onKassier to grant and revoke', () => {
    const el = document.createElement('div');
    const onKassier = vi.fn();
    const users = [
      { ...USERS[0], is_kassier: true },
      { ...USERS[1], is_kassier: false },
    ];
    renderVorstand(el, users, { isAdmin: true, onKassier });
    const rows = Array.from(el.querySelectorAll('[data-user]'));
    rows.find((r) => r.textContent.includes('Ben')).querySelector('[data-kassier-grant]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onKassier).toHaveBeenCalledWith(users[1], { is_kassier: true });
    rows.find((r) => r.textContent.includes('Ava')).querySelector('[data-kassier-revoke]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onKassier).toHaveBeenCalledWith(users[0], { is_kassier: false });
  });

  it('link button fires onLink with slot and user id, unlink fires onUnlink', () => {
    const el = document.createElement('div');
    const onLink = vi.fn();
    const onUnlink = vi.fn();
    renderVorstand(el, [USERS[1]], { isAdmin: true, links: {}, onLink, onUnlink });
    const card = Array.from(el.querySelectorAll('[data-slot]')).find((c) => c.dataset.slot === 'kassier');
    card.querySelector('select[data-link]').value = 'u2';
    card.querySelector('[data-do-link]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onLink).toHaveBeenCalledWith('kassier', 'u2');
    const el2 = document.createElement('div');
    renderVorstand(el2, [USERS[1]], { isAdmin: true, links: { obmann: 'u2' }, onLink, onUnlink });
    el2.querySelector('[data-unlink]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onUnlink).toHaveBeenCalledWith('obmann');
  });
});
