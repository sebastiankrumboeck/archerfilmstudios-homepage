import { describe, expect, it } from 'vitest';
import { renderMemberDetail, renderMemberList } from '../src/views/members.js';

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
});
