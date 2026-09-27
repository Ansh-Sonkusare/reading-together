import { expect, test } from 'vitest';
import { stack, tilt } from './sticky-layout';

test('notes far apart keep their own tops', () => {
  expect(stack([{ id: 'a', top: 100, height: 80 }, { id: 'b', top: 300, height: 80 }])).toEqual(new Map([['a', 100], ['b', 300]]));
});

test('an overlapping note slides down to clear the one above, in top order', () => {
  const out = stack([
    { id: 'c', top: 130, height: 60 },
    { id: 'a', top: 100, height: 80 },
    { id: 'b', top: 110, height: 40 },
  ]);
  expect([...out]).toEqual([['a', 100], ['b', 192], ['c', 244]]);
});

test('the gap is configurable', () => {
  expect(stack([{ id: 'a', top: 0, height: 28 }, { id: 'b', top: 0, height: 28 }], 4)).toEqual(new Map([['a', 0], ['b', 32]]));
});

test('tilt is a hair, and the same every time for one id', () => {
  for (const id of ['a', 'note-1', '8c1f0e0a-1b2c-4d5e-8f90-123456789abc']) {
    expect(Math.abs(tilt(id))).toBeLessThanOrEqual(1.5);
    expect(tilt(id)).toBe(tilt(id));
  }
  expect(tilt('a')).toBe(1.5);
});
