import { fromPos } from '../reader/locator';

export const CHARS_PER_PAGE = 1500;

// display_page() in SQL mirrors this for couple_stats; both are tested against the same inputs.
export function displayPage(pos: number, spineLengths: readonly number[]): number {
  const { spine, offset } = fromPos(pos, spineLengths);
  const before = spineLengths.slice(0, spine).reduce((a, b) => a + b, 0);
  return Math.floor((before + offset) / CHARS_PER_PAGE) + 1;
}
