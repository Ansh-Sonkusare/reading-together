import { describe, expect, it } from 'vitest';
import { displayPage } from '../reader/locator';

// tests/db/together.test.ts runs display_page() in SQL on these same rows.
const CASES: [number, number[], number][] = [
  [0, [1000, 2000], 1],
  [0.5, [1000, 2000], 1],
  [1.25, [1000, 2000], 2],
  [1.5, [1000, 2000], 2],
  [2, [1000, 2000], 3],
  [0.9999, [3000], 3],
];

describe('displayPage', () => {
  it.each(CASES)('pos %d in %j is page %d', (pos, lengths, page) => {
    expect(displayPage(pos, lengths)).toBe(page);
  });
});
