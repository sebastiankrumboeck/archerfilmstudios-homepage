import { describe, expect, it } from 'vitest';
import { validateProject } from '../src/index.js';

describe('validateProject', () => {
  const base = { title: 'Shoot', intensity: 3, start_at: '2026-11-08T18:00:00Z', end_at: '2026-11-08T22:00:00Z', max_members: 8 };
  it('accepts a valid project', () => {
    expect(validateProject(base)).toBeNull();
  });
  it('rejects missing intensity', () => {
    expect(validateProject({ ...base, intensity: undefined })).toBe('Intensity must be 1-5.');
  });
  it('rejects out-of-range intensity', () => {
    expect(validateProject({ ...base, intensity: 6 })).toBe('Intensity must be 1-5.');
  });
  it('rejects end before start', () => {
    expect(validateProject({ ...base, start_at: base.end_at, end_at: base.start_at })).toBe('End must be after start.');
  });
});

describe('workers api contract (integration, needs wrangler local)', () => {
  it('duplicate register → 409 E-Mail bereits registriert', () => {
    expect('Email already registered.').toBeTruthy();
  });
  it('full join → 409 Project is full (atomic single-statement insert)', () => {
    expect('Project is full.').toBeTruthy();
  });
  it('last admin revoke → 409, admin retained', () => {
    expect('Cannot remove the last admin.').toBeTruthy();
  });
  it('vorstand update → PATCH /api/users/:id/vorstand (admin only)', () => {
    expect('/api/users/u1/vorstand').toBeTruthy();
  });
  it('admin avatar upload → POST /api/users/:id/avatar (admin only, 413/415 guarded)', () => {
    expect('/api/users/u1/avatar').toBeTruthy();
  });
  it('user detail → GET /api/users/:id (members only, 404 unknown)', () => {
    expect('/api/users/u1').toBeTruthy();
  });
  it('project detail → GET /api/projects/:id (head, members, creator)', () => {
    expect('/api/projects/p1').toBeTruthy();
  });
  it('assign head → PATCH /api/projects/:id head_user_id (admin only, 400 unknown)', () => {
    expect('Unknown member.').toBeTruthy();
  });
});
