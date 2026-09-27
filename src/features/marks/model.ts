import type { Member } from '@/features/couple/couple';
import type { Locator, PaintMark, Pos } from '@/features/reader';
import type { Enums, Tables } from '@/lib/types';

export type Reaction = Enums<'reaction'>;

export const REACTIONS: ReadonlyArray<{ key: Reaction; emoji: string; label: string }> = [
  { key: 'love', emoji: '❤️', label: 'Love this' },
  { key: 'funny', emoji: '😂', label: 'Funny' },
  { key: 'emotional', emoji: '😭', label: 'Emotional' },
  { key: 'surprised', emoji: '😮', label: 'Surprised' },
  { key: 'interesting', emoji: '🤔', label: 'Interesting' },
  { key: 'favorite', emoji: '🔥', label: 'Favorite' },
  { key: 'think', emoji: '💭', label: 'Made me think' },
];

export type NewMark =
  | { kind: 'highlight'; bookId: string; locator: Locator; pos: Pos }
  | { kind: 'reaction'; bookId: string; locator: Locator; pos: Pos; emoji: Reaction }
  | { kind: 'note'; bookId: string; locator: Locator; pos: Pos; body: string }
  | { kind: 'bookmark'; bookId: string; locator: Locator; pos: Pos; label: string }
  | { kind: 'send'; bookId: string; locator: Locator; pos: Pos; body: string | null }
  | { kind: 'reply'; bookId: string; parentId: string; body: string };

export const BOOKMARK_LABELS = ['First quote we both loved', 'Favorite chapter', 'Funny part', 'Important conversation'];

const MEMORY_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' };
export const MEMORY_MAX_BYTES = 10 * 1024 * 1024;

// Mirrors the memories bucket's allowed_mime_types and file_size_limit, so a bad photo fails before it's sent.
export function memoryExt(file: { type: string; size: number }): string {
  const ext = MEMORY_EXT[file.type];
  if (!ext) throw new Error('Choose a JPEG, PNG, WebP or HEIC photo.');
  if (file.size > MEMORY_MAX_BYTES) throw new Error('Photos can be up to 10 MB.');
  return ext;
}

export type Mark = Omit<Tables<'mark'>, 'locator'> & { locator: Locator | null };

export type Anchor = { cfi: string; locator: Locator; pos: Pos; marks: Mark[]; replies: Mark[] };

export type { Member };

// Bookmarks and sends point at a passage but live in their own lists, not in the book's paint and threads.
const inText = (m: Mark) => m.kind !== 'bookmark' && m.kind !== 'send';

const byTime = (a: Mark, b: Mark) => a.created_at.localeCompare(b.created_at);

export function groupByAnchor(marks: Mark[]): Anchor[] {
  const byId = new Map(marks.map((m) => [m.id, m]));
  const anchors = new Map<string, Anchor>();
  const rootOf = (m: Mark | undefined): Mark | undefined => {
    while (m?.parent_id) m = byId.get(m.parent_id);
    return m;
  };

  const sorted = [...marks].sort(byTime);
  for (const m of sorted) {
    if (m.parent_id || !m.locator || !inText(m)) continue;
    const a = anchors.get(m.locator.cfi);
    if (a) a.marks.push(m);
    else anchors.set(m.locator.cfi, { cfi: m.locator.cfi, locator: m.locator, pos: m.pos as Pos, marks: [m], replies: [] });
  }
  for (const m of sorted) {
    if (!m.parent_id) continue;
    const cfi = rootOf(m)?.locator?.cfi;
    if (cfi) anchors.get(cfi)?.replies.push(m);
  }
  return [...anchors.values()].sort((a, b) => a.pos - b.pos);
}

// Marks that just became visible because my max_pos rose past them (RLS hid them until then, D9).
export function revealedBy(before: { ids: Set<string>; maxPos: number }, after: Mark[]): Mark[] {
  return after.filter((m) => !before.ids.has(m.id) && Number(m.pos) > before.maxPos && !m.parent_id && m.locator && inText(m));
}

// The toast's summary of what appeared: the reaction's emoji, else a word for the kind.
export function describe(m: Mark): string {
  if (m.kind === 'reaction') return REACTIONS.find((r) => r.key === m.emoji)?.emoji ?? 'a reaction';
  return m.kind === 'note' ? 'a note' : m.kind === 'memory' ? 'a memory' : 'a highlight';
}

const UNKNOWN_COLOR = '#9ca3af';

function blend(a: string, b: string): string {
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [x, y] = [rgb(a), rgb(b)];
  return '#' + x.map((v, i) => Math.round((v + y[i]) / 2).toString(16).padStart(2, '0')).join('');
}

// A range both partners marked is drawn as an underline in the blend of their colours:
// a blended fill alone can equal a palette colour (red + blue ≈ purple) and read as one person.
export function toPaintMarks(anchors: Anchor[], members: Member[]): PaintMark[] {
  const colorOf = (id: string) => members.find((m) => m.userId === id)?.color ?? UNKNOWN_COLOR;
  return anchors.map((a) => {
    const authors = [...new Set(a.marks.map((m) => m.author_id))].sort();
    return authors.length > 1
      ? { id: a.cfi, locator: a.locator, color: blend(colorOf(authors[0]), colorOf(authors[1])), kind: 'underline' }
      : { id: a.cfi, locator: a.locator, color: colorOf(authors[0]), kind: 'highlight' };
  });
}
