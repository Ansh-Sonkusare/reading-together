export type StatsCounts = { booksTogether: number; pages: number; highlights: number; discussions: number };

const n = (count: number, one: string, many = `${one}s`) => `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;

/** /together's stats as one warm sentence instead of four tiles (docs/design.md). */
export function statsSentence({ booksTogether, pages, highlights, discussions }: StatsCounts): string {
  if (!pages && !highlights && !discussions) return 'Nothing read together yet. Open a book and your story starts here.';
  const extras = [highlights && `left ${n(highlights, 'highlight')}`, discussions && `swapped ${n(discussions, 'answer')}`].filter(Boolean);
  const books = booksTogether ? ` across ${n(booksTogether, 'book')}` : '';
  return `You've read ${n(pages, 'page')} together${books}${extras.length ? `, ${new Intl.ListFormat('en').format(extras as string[])}` : ''}.`;
}
