import { describe, expect, it } from 'vitest';
import { intensityColor, intensityLabel } from '../src/lib/intensity.js';
import { canJoin, isLastAdmin } from '../src/lib/validators.js';
import { monthSpan, buildMailto } from '../src/lib/calendar.js';

describe('intensity', () => {
  it('maps 1-5 to spec hex colors', () => {
    expect(intensityColor(1)).toBe('#10b981');
    expect(intensityColor(2)).toBe('#a3e635');
    expect(intensityColor(3)).toBe('#dda85b');
    expect(intensityColor(4)).toBe('#fb923c');
    expect(intensityColor(5)).toBe('#ef4444');
  });

  it('labels intensity levels', () => {
    expect(intensityLabel(1)).toBeTruthy();
    expect(intensityLabel(5)).toBeTruthy();
  });

  it('throws on out-of-range intensity', () => {
    expect(() => intensityColor(0)).toThrow(RangeError);
    expect(() => intensityColor(6)).toThrow(RangeError);
  });
});

describe('join validator', () => {
  it('allows open join', () => {
    expect(canJoin(3, 8, [], 'u1')).toEqual({ ok: true, reason: null });
  });

  it('blocks full project', () => {
    expect(canJoin(8, 8, [], 'u9')).toEqual({ ok: false, reason: 'full' });
  });

  it('blocks duplicate join', () => {
    expect(canJoin(3, 8, ['u1'], 'u1')).toEqual({ ok: false, reason: 'already' });
  });

  it('allows unlimited when max is null', () => {
    expect(canJoin(99, null, [], 'u1')).toEqual({ ok: true, reason: null });
  });

  it('detects last admin', () => {
    expect(isLastAdmin([{ id: 'a1' }], 'a1')).toBe(true);
    expect(isLastAdmin([{ id: 'a1' }, { id: 'a2' }], 'a1')).toBe(false);
    expect(isLastAdmin([{ id: 'a1' }], 'other')).toBe(false);
  });
});

describe('calendar span', () => {
  it('computes span within month', () => {
    expect(monthSpan('2026-10-05T10:00:00Z', '2026-10-07T12:00:00Z', 2026, 10)).toEqual({
      startDay: 5,
      span: 3,
    });
  });

  it('clips span to visible month', () => {
    const r = monthSpan('2026-09-28T00:00:00Z', '2026-10-03T00:00:00Z', 2026, 10);
    expect(r).toEqual({ startDay: 1, span: 3 });
  });

  it('returns null outside month', () => {
    expect(monthSpan('2026-11-01T00:00:00Z', '2026-11-02T00:00:00Z', 2026, 10)).toBeNull();
  });
});

describe('mailto', () => {
  it('builds mailto to archerfilmstudios@gmail.com', () => {
    const url = buildMailto({ subject: 'Hi', body: 'Hello world' });
    expect(url.startsWith('mailto:archerfilmstudios@gmail.com')).toBe(true);
    expect(url).toContain(encodeURIComponent('Hi'));
    expect(url).toContain(encodeURIComponent('Hello world'));
  });
});
