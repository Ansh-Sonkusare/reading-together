import { describe, expect, it } from 'vitest';
import { goalProgressText, streak, streakText } from './streak';

describe('streak', () => {
  it('counts consecutive days both partners read, ending today', () => {
    expect(streak(['2026-09-25', '2026-09-26', '2026-09-27'], ['2026-09-25', '2026-09-26', '2026-09-27'], '2026-09-27')).toBe(3);
  });

  it("keeps yesterday's streak while today isn't read yet", () => {
    expect(streak(['2026-09-25', '2026-09-26'], ['2026-09-25', '2026-09-26'], '2026-09-27')).toBe(2);
  });

  it('keeps the streak when only one partner has read today', () => {
    expect(streak(['2026-09-26', '2026-09-27'], ['2026-09-26'], '2026-09-27')).toBe(1);
  });

  it('breaks on a day only one partner read', () => {
    expect(streak(['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'], ['2026-09-24', '2026-09-26', '2026-09-27'], '2026-09-27')).toBe(2);
  });

  it('breaks on a gap', () => {
    expect(streak(['2026-09-23', '2026-09-24', '2026-09-26'], ['2026-09-23', '2026-09-24', '2026-09-26'], '2026-09-27')).toBe(1);
  });

  it('is 0 when the last shared day is before yesterday', () => {
    expect(streak(['2026-09-25'], ['2026-09-25'], '2026-09-27')).toBe(0);
  });

  it('crosses a month boundary', () => {
    expect(streak(['2026-09-30', '2026-10-01'], ['2026-10-01', '2026-09-30'], '2026-10-01')).toBe(2);
  });
});

describe('streakText', () => {
  it.each([
    [0, 'Start a streak: read today together'],
    [1, '🔥 1-day reading streak'],
    [7, '🔥 7-day reading streak'],
  ])('%d → %s', (n, text) => {
    expect(streakText(n)).toBe(text);
  });
});

describe('goalProgressText', () => {
  it('shows each reader against the target, ticking who met it', () => {
    expect(
      goalProgressText({ kind: 'pages_per_day', target: 10 }, [
        { name: 'You', done: 7 },
        { name: 'Sam', done: 10 },
      ]),
    ).toBe('Today: You 7/10 pages · Sam 10/10 ✓');
  });

  it('uses the singular unit for a target of 1', () => {
    expect(
      goalProgressText({ kind: 'chapters_per_day', target: 1 }, [
        { name: 'You', done: 2 },
        { name: 'Sam', done: 0 },
      ]),
    ).toBe('Today: You 2/1 chapter ✓ · Sam 0/1');
  });
});
