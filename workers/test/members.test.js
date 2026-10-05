import { describe, expect, it } from 'vitest';
import { validateHeadId } from '../src/index.js';

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
