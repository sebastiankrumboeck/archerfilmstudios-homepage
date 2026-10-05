import { describe, expect, it, vi } from 'vitest';
import { intensityColor } from '../src/lib/intensity.js';
import { buildMailto, monthSpan } from '../src/lib/calendar.js';
import { renderProjectCard, renderProjectForm } from '../src/views/projects.js';

const PROJECT = { id: 'p1', title: 'Shoot', description: 'Desc', intensity: 4, location: 'Berlin', start_at: '2026-11-08T18:00:00Z', end_at: '2026-11-08T22:00:00Z', max_members: 8, member_count: 3, members: [] };

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
});
