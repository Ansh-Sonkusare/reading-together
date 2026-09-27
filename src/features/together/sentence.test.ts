import { expect, it } from 'vitest';
import { statsSentence } from './sentence';

it('says the counts as one sentence, singular where it should be', () => {
  expect(statsSentence({ booksTogether: 2, pages: 1342, highlights: 18, discussions: 3 })).toBe(
    "You've read 1,342 pages together across 2 books, left 18 highlights and swapped 3 answers.",
  );
  expect(statsSentence({ booksTogether: 1, pages: 1, highlights: 1, discussions: 0 })).toBe("You've read 1 page together across 1 book, left 1 highlight.");
  expect(statsSentence({ booksTogether: 0, pages: 12, highlights: 0, discussions: 0 })).toBe("You've read 12 pages together.");
});

it('invites a start when nothing has happened yet', () => {
  expect(statsSentence({ booksTogether: 0, pages: 0, highlights: 0, discussions: 0 })).toBe('Nothing read together yet. Open a book and your story starts here.');
});
