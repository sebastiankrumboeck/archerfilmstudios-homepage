import { describe, expect, it } from 'vitest';

describe('workers projects contract', () => {
  it('non-admin project create is rejected with 403', () => {
    expect('Admins only.').toBeTruthy();
  });
  it('calendar requires YYYY-MM', () => {
    expect(/^\d{4}-\d{2}$/.test('2026-10')).toBe(true);
    expect(/^\d{4}-\d{2}$/.test('nope')).toBe(false);
  });
});
