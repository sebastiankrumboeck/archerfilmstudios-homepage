import { describe, expect, it, vi } from 'vitest';
import { intensityColor } from '../src/lib/intensity.js';
import { buildMailto, monthSpan } from '../src/lib/calendar.js';
import { renderProjectCard, renderProjectDetail, renderProjectForm, renderReminderToggle } from '../src/views/projects.js';
import { renderCalendar } from '../src/views/calendar.js';

const PROJECT = { id: 'p1', title: 'Shoot', description: 'Desc', intensity: 4, location: 'Berlin', start_at: '2026-11-08T18:00:00Z', end_at: '2026-11-08T22:00:00Z', max_members: 8, member_count: 3, members: [] };
const ALICE = { id: 'u-1', name: 'Alice', function: 'Camera', avatar_r2_key: null, is_admin: false, is_vorstand: false, vorstand_title: null };
const BOB = { id: 'u-2', name: 'Bob', function: 'Sound', avatar_r2_key: null, is_admin: false, is_vorstand: false, vorstand_title: null };
const CAROL = { id: 'u-9', name: 'Carol', function: 'Editing', avatar_r2_key: null, is_admin: true, is_vorstand: false, vorstand_title: null };
const DETAIL = {
  project: { ...PROJECT, head_user_id: 'u-1' },
  head: ALICE,
  members: [ALICE, BOB],
  creator: CAROL,
  member_count: 2,
  isMember: false,
  canEdit: false,
};

describe('views', () => {
  it('project card uses intensity color and join label Join (3/8)', () => {
    const el = document.createElement('div');
    renderProjectCard(el, { id: 'p1', title: 'Shoot', intensity: 4, start_at: '2026-11-08T18:00:00Z', end_at: '2026-11-08T22:00:00Z', max_members: 8, member_count: 3, members: [], isMember: false });
    expect(el.innerHTML).toContain(intensityColor(4));
    expect(el.textContent).toContain('Join (3/8)');
  });

  it('full project disables join with Full (8/8)', () => {
    const el = document.createElement('div');
    renderProjectCard(el, { id: 'p1', title: 'Shoot', intensity: 2, start_at: '2026-11-08T18:00:00Z', end_at: '2026-11-08T22:00:00Z', max_members: 8, member_count: 8, members: [], isMember: false });
    expect(el.querySelector('button:disabled')).toBeTruthy();
    expect(el.textContent).toContain('Full (8/8)');
  });

  it('contact form builds mailto to archerfilmstudios@gmail.com', () => {
    const url = buildMailto({ subject: 'Hi', body: 'Test' });
    expect(url.startsWith('mailto:archerfilmstudios@gmail.com')).toBe(true);
  });

  it('calendar bar spans start to end days', () => {
    expect(monthSpan('2026-10-05T10:00:00Z', '2026-10-07T12:00:00Z', 2026, 10)).toEqual({ startDay: 5, span: 3 });
  });

  it('calendar bars link to the project detail page', () => {
    const el = document.createElement('div');
    renderCalendar(el, 2026, 11, [{ ...PROJECT, start_at: '2026-11-08T18:00:00Z', end_at: '2026-11-08T22:00:00Z' }], {});
    const bar = el.querySelector('a[href="/projects/?id=p1"]');
    expect(bar).toBeTruthy();
    expect(bar.textContent).toContain('Shoot');
  });

  it('project card links to the project detail page', () => {
    const el = document.createElement('div');
    renderProjectCard(el, { id: 'p1', title: 'Shoot', intensity: 4, start_at: '2026-11-08T18:00:00Z', end_at: '2026-11-08T22:00:00Z', max_members: 8, member_count: 3, members: [], isMember: false });
    const link = el.querySelector('a[href="/projects/?id=p1"]');
    expect(link).toBeTruthy();
    expect(link.textContent).toContain('Shoot');
  });

  it('reminder toggle shows state and fires the flipped value', () => {
    const el = document.createElement('div');
    const onToggle = vi.fn();
    renderReminderToggle(el, { enabled: true, canToggle: true, onToggle });
    expect(el.textContent).toMatch(/Turn reminders off/);
    el.querySelector('[data-reminder-toggle]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onToggle).toHaveBeenCalledWith(false);
    const off = document.createElement('div');
    renderReminderToggle(off, { enabled: false, canToggle: true, onToggle: vi.fn() });
    expect(off.textContent).toMatch(/Turn reminders on/);
    const hidden = document.createElement('div');
    renderReminderToggle(hidden, { enabled: true, canToggle: false, onToggle: vi.fn() });
    expect(hidden.querySelector('[data-reminder-toggle]')).toBeNull();
  });

  it('admin edit button fires onEdit with the project', () => {
    const el = document.createElement('div');
    const onEdit = vi.fn();
    renderProjectCard(el, PROJECT, { isAdmin: true, onEdit });
    el.querySelector('[data-edit]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onEdit).toHaveBeenCalledWith(PROJECT);
  });

  it('admin delete button fires onDelete with the project', () => {
    const el = document.createElement('div');
    const onDelete = vi.fn();
    renderProjectCard(el, PROJECT, { isAdmin: true, onDelete });
    el.querySelector('[data-delete]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onDelete).toHaveBeenCalledWith(PROJECT);
  });

  it('edit form prefills values and PATCHes on submit', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { project: { ...PROJECT, title: 'Neu' } } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const el = document.createElement('div');
      const onSave = vi.fn();
      renderProjectForm(el, { project: PROJECT, onSave });
      const form = el.querySelector('form');
      expect(form.querySelector('[name="title"]').value).toBe('Shoot');
      expect(form.querySelector('[name="intensity"]').value).toBe('4');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/projects/p1');
      expect(opts.method).toBe('PATCH');
      expect(JSON.parse(opts.body).title).toBe('Shoot');
      await vi.waitFor(() => expect(onSave).toHaveBeenCalled());
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('member button stays enabled and fires onLeave instead of onJoin', () => {
    const el = document.createElement('div');
    const onJoin = vi.fn();
    const onLeave = vi.fn();
    renderProjectCard(el, PROJECT, { isMember: true, onJoin, onLeave });
    const button = el.querySelector('[data-join]');
    expect(button.disabled).toBe(false);
    expect(button.textContent).toContain('Joined');
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onLeave).toHaveBeenCalledWith(PROJECT);
    expect(onJoin).not.toHaveBeenCalled();
  });

  it('non-member button still fires onJoin', () => {
    const el = document.createElement('div');
    const onJoin = vi.fn();
    const onLeave = vi.fn();
    renderProjectCard(el, PROJECT, { isMember: false, onJoin, onLeave });
    el.querySelector('[data-join]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onJoin).toHaveBeenCalledWith(PROJECT);
    expect(onLeave).not.toHaveBeenCalled();
  });

  it('escapes HTML in project titles', () => {
    const el = document.createElement('div');
    renderProjectCard(el, { ...PROJECT, title: '<img src=x onerror=alert(1)>' }, {});
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('project detail renders head name and one link per member', () => {
    const el = document.createElement('div');
    renderProjectDetail(el, DETAIL, {});
    expect(el.textContent).toContain('Alice');
    expect(el.textContent).toContain('Head');
    const links = [...el.querySelectorAll('a[href^="/members/?id="]')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/members/?id=u-1', '/members/?id=u-2']);
  });

  it('project detail falls back to the creator when head is null', () => {
    const el = document.createElement('div');
    renderProjectDetail(el, { ...DETAIL, head: null }, {});
    expect(el.textContent).toContain('Carol');
    expect(el.textContent).toContain('Organized by');
  });

  it('project detail escapes HTML in the title', () => {
    const el = document.createElement('div');
    renderProjectDetail(el, { ...DETAIL, project: { ...DETAIL.project, title: '<img src=x onerror=alert(1)>' } }, {});
    expect(el.querySelector('img[src="x"]')).toBeNull();
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('project detail shows the head select only for admins', () => {
    const admin = document.createElement('div');
    renderProjectDetail(admin, DETAIL, { isAdmin: true });
    expect(admin.querySelector('select[data-head]')).toBeTruthy();
    const plain = document.createElement('div');
    renderProjectDetail(plain, DETAIL, {});
    expect(plain.querySelector('select[data-head]')).toBeNull();
  });

  it('project detail renders a not-found view for null data', () => {
    const el = document.createElement('div');
    renderProjectDetail(el, null, {});
    expect(el.textContent).toMatch(/not found/i);
  });

  it('project detail uses the top-level member_count for the join label', () => {
    const el = document.createElement('div');
    const bareProject = { ...DETAIL.project };
    delete bareProject.member_count;
    renderProjectDetail(el, { ...DETAIL, project: bareProject, member_count: 2 }, {});
    expect(el.textContent).toContain('Join (2/8)');
  });

  it('project detail disables join when the count reaches max', () => {
    const el = document.createElement('div');
    const bareProject = { ...DETAIL.project };
    delete bareProject.member_count;
    renderProjectDetail(el, { ...DETAIL, project: bareProject, member_count: 8 }, {});
    expect(el.querySelector('[data-join]').disabled).toBe(true);
    expect(el.textContent).toContain('Full (8/8)');
  });

  it('project form offers head selection and sends head_user_id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { project: { ...PROJECT, head_user_id: 'u-1' } } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const el = document.createElement('div');
      const onCreate = vi.fn();
      renderProjectForm(el, { users: [{ id: 'u-1', name: 'Alice' }], onCreate });
      const form = el.querySelector('form');
      const select = form.querySelector('select[name="head_user_id"]');
      expect([...select.options].some((o) => o.value === 'u-1' && o.textContent === 'Alice')).toBe(true);
      form.querySelector('[name="title"]').value = 'T';
      form.querySelector('[name="intensity"]').value = '3';
      form.querySelector('[name="start_at"]').value = '2026-11-08T18:00';
      form.querySelector('[name="end_at"]').value = '2026-11-08T20:00';
      select.value = 'u-1';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/projects');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body).head_user_id).toBe('u-1');
      await vi.waitFor(() => expect(onCreate).toHaveBeenCalled());
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
