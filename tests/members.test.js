import { describe, expect, it, vi } from 'vitest';
import { matchMember, renderMemberDetail, renderMemberList, renderOwnProfileForm } from '../src/views/members.js';

const ALICE = { id: 'u-1', name: 'Alice', function: 'Camera', avatar_r2_key: 'avatars/u-1-1.jpg', is_admin: false, is_vorstand: false, vorstand_title: null };
const BOB = { id: 'u-2', name: 'Bob', function: 'Sound', avatar_r2_key: null, is_admin: false, is_vorstand: false, vorstand_title: null };

describe('members views', () => {
  it('list renders each escaped name with a link to /members/?id=<id>', () => {
    const el = document.createElement('div');
    renderMemberList(el, [ALICE, BOB]);
    const links = [...el.querySelectorAll('a[href^="/members/?id="]')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/members/?id=u-1', '/members/?id=u-2']);
    expect(el.textContent).toContain('Alice');
    expect(el.textContent).toContain('Bob');
  });

  it('list search box fires onSearch with the typed value', () => {
    const el = document.createElement('div');
    const onSearch = vi.fn();
    renderMemberList(el, [ALICE, BOB], { onSearch });
    const input = el.querySelector('[data-member-search]');
    expect(input).toBeTruthy();
    input.value = 'ali';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onSearch).toHaveBeenCalledWith('ali');
  });

  it('matchMember matches name and function case-insensitively', () => {
    expect(matchMember(ALICE, '')).toBe(true);
    expect(matchMember(ALICE, 'ali')).toBe(true);
    expect(matchMember(BOB, 'SOUND')).toBe(true);
    expect(matchMember(ALICE, 'zzz')).toBe(false);
  });

  it('detail renders avatar img when set and fallback circle otherwise', () => {
    const withAvatar = document.createElement('div');
    renderMemberDetail(withAvatar, { user: ALICE, projects: { joined: [], headed: [] } });
    expect(withAvatar.querySelector('img[src="/avatars/u-1-1.jpg"]')).toBeTruthy();
    const withoutAvatar = document.createElement('div');
    renderMemberDetail(withoutAvatar, { user: BOB, projects: { joined: [], headed: [] } });
    expect(withoutAvatar.querySelector('img')).toBeNull();
    expect(withoutAvatar.textContent).toContain('B');
  });

  it('detail escapes an XSS probe name as inert text', () => {
    const el = document.createElement('div');
    renderMemberDetail(el, { user: { ...ALICE, name: '<img src=x onerror=alert(1)>' }, projects: { joined: [], headed: [] } });
    expect(el.querySelector('img[src="x"]')).toBeNull();
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('detail renders a not-found view for a null user', () => {
    const el = document.createElement('div');
    renderMemberDetail(el, null);
    expect(el.textContent).toMatch(/not found/i);
  });

  it('own profile form uploads the photo before signaling saved', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const el = document.createElement('div');
      const onSave = vi.fn().mockResolvedValue({ user: ALICE });
      const onSaved = vi.fn();
      renderOwnProfileForm(el, ALICE, { onSave, onSaved });
      const form = el.querySelector('[data-profile-form]');
      Object.defineProperty(form.querySelector('[name="avatar"]'), 'files', {
        value: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })],
      });
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
      expect(fetchMock).toHaveBeenCalledWith('/api/users/me/avatar', expect.objectContaining({ method: 'POST' }));
      expect(fetchMock.mock.invocationCallOrder[0]).toBeLessThan(onSaved.mock.invocationCallOrder[0]);
      expect(el.querySelector('[data-error]').textContent).toBe('');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
