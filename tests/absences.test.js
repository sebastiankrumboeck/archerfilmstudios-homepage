import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  renderProjectCard,
  renderAbsenceDecision,
  isLateLeave,
  banLabel,
} from '../src/views/projects.js';
import { renderMemberDetail } from '../src/views/members.js';
import { safeNext } from '../src/views/auth.js';

const FUTURE = { id: 'p1', title: 'Weitwurf', description: '', intensity: 2, location: 'St. Pölten', start_at: '2026-10-20T18:00:00.000Z', end_at: '2026-10-20T22:00:00.000Z', max_members: 10, member_count: 1, members: [] };
const LATE = { ...FUTURE, id: 'p2', title: 'Nachtdreh', start_at: '2026-10-12T18:00:00.000Z' };

function closeModals() {
  document.querySelectorAll('[data-modal-overlay]').forEach((el) => el.remove());
}

describe('absence frontend', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse('2026-10-10T12:00:00.000Z'));
  });
  afterEach(() => {
    closeModals();
    vi.useRealTimers();
  });

  it('isLateLeave flips 3 days before start', () => {
    expect(isLateLeave(FUTURE)).toBe(false);
    expect(isLateLeave(LATE)).toBe(true);
  });

  it('banLabel formats a future ban in German and ignores past bans', () => {
    expect(banLabel('2026-10-24T12:00:00.000Z')).toContain('24.10.2026');
    expect(banLabel(null)).toBeNull();
    expect(banLabel('2026-10-01T12:00:00.000Z')).toBeNull();
  });

  it('join opens a confirm modal; Abbrechen closes, Bestätigen joins', () => {
    const el = document.createElement('div');
    const onJoin = vi.fn();
    renderProjectCard(el, FUTURE, { onJoin, onLeave: vi.fn() });
    el.querySelector('[data-join]').click();
    const modal = document.querySelector('[data-modal-overlay]');
    expect(modal).toBeTruthy();
    expect(modal.textContent).toContain('Teilnahme bestätigen');
    modal.querySelector('[data-modal-cancel]').click();
    expect(document.querySelector('[data-modal-overlay]')).toBeNull();
    expect(onJoin).not.toHaveBeenCalled();
    el.querySelector('[data-join]').click();
    document.querySelector('[data-modal-confirm]').click();
    expect(onJoin).toHaveBeenCalledWith(FUTURE);
  });

  it('banned users get a disabled join button with the ban date', () => {
    const el = document.createElement('div');
    renderProjectCard(el, FUTURE, { onJoin: vi.fn(), onLeave: vi.fn(), bannedUntil: '2026-10-24T12:00:00.000Z' });
    const btn = el.querySelector('[data-join]');
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain('24.10.2026');
    btn.click();
    expect(document.querySelector('[data-modal-overlay]')).toBeNull();
  });

  it('leave within the Frist confirms without a reason', () => {
    const el = document.createElement('div');
    const onLeave = vi.fn();
    renderProjectCard(el, { ...FUTURE, members: [{ id: 'u-1', name: 'Max' }] }, { isMember: true, myId: 'u-1', onJoin: vi.fn(), onLeave });
    el.querySelector('[data-join]').click();
    const modal = document.querySelector('[data-modal-overlay]');
    expect(modal.textContent).toContain('Abmelden');
    expect(modal.querySelector('[data-reason]')).toBeNull();
    modal.querySelector('[data-modal-confirm]').click();
    expect(onLeave).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }), expect.objectContaining({ reason: '' }));
  });

  it('late leave warns, requires a reason and passes it through', () => {
    const el = document.createElement('div');
    const onLeave = vi.fn();
    renderProjectCard(el, { ...LATE, members: [{ id: 'u-1', name: 'Max' }] }, { isMember: true, myId: 'u-1', onJoin: vi.fn(), onLeave });
    el.querySelector('[data-join]').click();
    const modal = document.querySelector('[data-modal-overlay]');
    expect(modal.textContent).toMatch(/Frist/i);
    modal.querySelector('[data-modal-confirm]').click();
    expect(onLeave).not.toHaveBeenCalled();
    modal.querySelector('[data-reason]').value = 'Bin krank.';
    modal.querySelector('[data-modal-confirm]').click();
    expect(onLeave).toHaveBeenCalledWith(expect.objectContaining({ id: 'p2' }), expect.objectContaining({ reason: 'Bin krank.' }));
  });

  it('member detail shows a temporary ban badge', () => {
    const el = document.createElement('div');
    renderMemberDetail(el, { user: { id: 'u-1', name: 'Ben', function: '', banned_until: '2026-10-24T12:00:00.000Z' }, projects: { joined: [], headed: [] } });
    expect(el.querySelector('[data-ban-badge]').textContent).toMatch(/24\.10\.2026/);
    const clean = document.createElement('div');
    renderMemberDetail(clean, { user: { id: 'u-1', name: 'Ben', function: '', banned_until: null }, projects: { joined: [], headed: [] } });
    expect(clean.querySelector('[data-ban-badge]')).toBeNull();
  });

  it('decision view shows the reason; rejection needs a note', () => {
    const el = document.createElement('div');
    const onApprove = vi.fn();
    const onReject = vi.fn();
    renderAbsenceDecision(el, { id: 'a-1', user_name: 'Max', project_title: 'Nachtdreh', reason: 'Bin krank.', status: 'pending' }, { onApprove, onReject });
    expect(el.textContent).toContain('Bin krank.');
    el.querySelector('[data-approve]').click();
    expect(onApprove).toHaveBeenCalledWith('a-1');
    el.querySelector('[data-reject]').click();
    el.querySelector('[data-decide]').click();
    expect(onReject).not.toHaveBeenCalled();
    el.querySelector('[data-note]').value = 'Das reicht nicht.';
    el.querySelector('[data-decide]').click();
    expect(onReject).toHaveBeenCalledWith('a-1', 'Das reicht nicht.');
  });

  it('safeNext only allows local paths', () => {
    expect(safeNext('/projects/?absence=a-1')).toBe('/projects/?absence=a-1');
    expect(safeNext('https://evil.example/x')).toBeNull();
    expect(safeNext('//evil.example/x')).toBeNull();
    expect(safeNext('')).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});
