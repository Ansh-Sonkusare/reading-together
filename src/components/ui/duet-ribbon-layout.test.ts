import { expect, it } from 'vitest';
import { layoutLabels, ribbonLabel, ribbonX } from './duet-ribbon-layout';

it('labels read "Alex p.42" and "you p.38"', () => {
  expect(ribbonLabel({ name: 'Alex', page: 42, isMe: false })).toBe('Alex p.42');
  expect(ribbonLabel({ name: 'Sam', page: 38, isMe: true })).toBe('you p.38');
});

it('ribbon x is pos/total clamped to the spine', () => {
  expect(ribbonX(42, 200)).toBe(0.21);
  expect(ribbonX(250, 200)).toBe(1);
  expect(ribbonX(-1, 200)).toBe(0);
  expect(ribbonX(5, 0)).toBe(0);
});

it('far-apart labels sit centred under their ribbons', () => {
  expect(layoutLabels([{ x: 0.2, w: 60 }, { x: 0.8, w: 60 }], 300)).toEqual([
    { left: 30, row: 0 },
    { left: 210, row: 0 },
  ]);
});

it('overlapping labels are nudged apart by the gap, keeping input order', () => {
  expect(layoutLabels([{ x: 0.52, w: 60 }, { x: 0.5, w: 60 }], 300)).toEqual([
    { left: 188, row: 0 },
    { left: 120, row: 0 },
  ]);
});

it('labels at the end of the book stay inside the track', () => {
  expect(layoutLabels([{ x: 1, w: 60 }, { x: 1, w: 70 }], 300)).toEqual([
    { left: 162, row: 0 },
    { left: 230, row: 0 },
  ]);
  expect(layoutLabels([{ x: 0, w: 60 }, { x: 0, w: 60 }], 300)).toEqual([
    { left: 0, row: 0 },
    { left: 68, row: 0 },
  ]);
});

it('labels too wide for one row split onto two', () => {
  expect(layoutLabels([{ x: 0.5, w: 60 }, { x: 0.5, w: 60 }], 100)).toEqual([
    { left: 20, row: 0 },
    { left: 20, row: 1 },
  ]);
});

it('two labels near each other on a 390px phone never overlap', () => {
  const [a, b] = layoutLabels([{ x: 0.4, w: 74 }, { x: 0.41, w: 66 }], 358);
  expect(a).toEqual({ left: 106, row: 0 });
  expect(b).toEqual({ left: 188, row: 0 });
});
