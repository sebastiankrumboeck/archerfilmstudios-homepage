import { describe, expect, it } from 'vitest';
import { validateHeadId, withMemberCounts } from '../src/index.js';

describe('validateHeadId', () => {
  it('accepts null (clears the head)', () => {
    expect(validateHeadId(null)).toBeNull();
  });
  it('accepts a non-empty id string', () => {
    expect(validateHeadId('u-123')).toBeNull();
  });
  it('rejects empty/blank ids', () => {
    expect(validateHeadId('')).toBe('Unknown member.');
    expect(validateHeadId('   ')).toBe('Unknown member.');
  });
});

describe('withMemberCounts', () => {
  const row = { id: 'u-1', email: 'a@b.c', pass_hash: 'x', name: 'A', function: 'F', avatar_r2_key: null, is_admin: 0, is_vorstand: 0, vorstand_title: null, created_at: '2026-01-01T00:00:00Z' };
  const fakeDb = {
    prepare: () => ({
      bind: () => ({
        first: async () => ({ n: 1 }),
        all: async () => ({ results: [row] }),
      }),
    }),
  };
  it('maps members to the public-user shape', async () => {
    const [p] = await withMemberCounts(fakeDb, [{ id: 'p1' }]);
    expect(p.member_count).toBe(1);
    expect(p.members[0]).toEqual({ id: 'u-1', name: 'A', function: 'F', avatar_r2_key: null, is_admin: false, is_vorstand: false, vorstand_title: null, is_kassier: false });
  });
});
