import type { Member } from '@/features/couple/couple';
import type { Color } from '@/features/couple/palette';
import type { Locator, PaintMark, Pos } from '@/features/reader';
import type { Tables } from '@/lib/types';

// Quick picks; any other emoji comes from the picker (D22). `key` names them for the guess game.
export const REACTIONS = [
  { key: 'love', emoji: '❤️', label: 'Love this' },
  { key: 'funny', emoji: '😂', label: 'Funny' },
  { key: 'emotional', emoji: '😭', label: 'Emotional' },
  { key: 'surprised', emoji: '😮', label: 'Surprised' },
  { key: 'interesting', emoji: '🤔', label: 'Interesting' },
  { key: 'favorite', emoji: '🔥', label: 'Favorite' },
  { key: 'think', emoji: '💭', label: 'Made me think' },
] as const;

// Highlights, notes and bookmarks may take their own ink; without one they're in the author's member ink.
export type NewMark =
  | { kind: 'highlight'; bookId: string; locator: Locator; pos: Pos; color?: Color }
  | { kind: 'reaction'; bookId: string; locator: Locator; pos: Pos; emoji: string }
  | { kind: 'note'; bookId: string; locator: Locator; pos: Pos; body: string; color?: Color }
  | { kind: 'bookmark'; bookId: string; locator: Locator; pos: Pos; label: string; color?: Color }
  | { kind: 'send'; bookId: string; locator: Locator; pos: Pos; body: string | null }
  | { kind: 'reply'; bookId: string; parentId: string; body: string };

export const BOOKMARK_LABELS = ['First quote we both loved', 'Favorite chapter', 'Funny part', 'Important conversation'];

const MEMORY_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const MEMORY_TYPES = Object.keys(MEMORY_EXT).join(',');
export const MEMORY_MAX_BYTES = 10 * 1024 * 1024;

// Mirrors the memories bucket's allowed_mime_types and file_size_limit, so a bad photo fails before it's sent.
// HEIC is refused (D23): only Safari displays it, so a partner on another browser would see a broken photo.
export function memoryExt(file: { type: string; size: number }): string {
  if (/^image\/hei[cf]$/.test(file.type)) throw new Error('HEIC photos only show in Safari. Choose a JPEG, PNG or WebP photo.');
  const ext = MEMORY_EXT[file.type];
  if (!ext) throw new Error('Choose a JPEG, PNG or WebP photo.');
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

// Only my own marks, and not one the partner replied under: deleting it would cascade to their words.
export function canRemove(mark: Mark, marks: Mark[], meId: string): boolean {
  if (mark.author_id !== meId) return false;
  const byId = new Map(marks.map((m) => [m.id, m]));
  const under = (m: Mark) => {
    for (let p = m.parent_id; p; p = byId.get(p)?.parent_id ?? null) if (p === mark.id) return true;
    return false;
  };
  return !marks.some((m) => m.author_id !== meId && under(m));
}

// The toast's summary of what appeared: the reaction's emoji, else a word for the kind.
export function describe(m: Mark): string {
  if (m.kind === 'reaction') return m.emoji ?? 'a reaction';
  return m.kind === 'note' ? 'a note' : m.kind === 'memory' ? 'a memory' : 'a highlight';
}

export type ReactionChip = { emoji: string; count: number; names: string[]; mine: Mark | undefined };

// Discord-style: one chip per emoji on the passage, in the order each emoji first appeared.
export function reactionChips(anchor: Anchor, members: Member[], meId: string): ReactionChip[] {
  const chips = new Map<string, ReactionChip>();
  for (const m of anchor.marks) {
    if (m.kind !== 'reaction' || !m.emoji) continue;
    const chip = chips.get(m.emoji) ?? { emoji: m.emoji, count: 0, names: [], mine: undefined };
    chip.count++;
    chip.names.push(m.author_id === meId ? 'You' : (members.find((p) => p.userId === m.author_id)?.name ?? 'Reader'));
    if (m.author_id === meId) chip.mine = m;
    chips.set(m.emoji, chip);
  }
  return [...chips.values()];
}

const UNKNOWN_COLOR = '#9ca3af';

// A mark's own ink, else its author's. An ink the partner has since switched to falls back too, so it can't read as theirs.
export function inkOf(mark: Pick<Mark, 'author_id' | 'color'>, members: Member[]): string {
  const own = mark.color && !members.some((p) => p.userId !== mark.author_id && p.color === mark.color);
  return own ? mark.color! : (members.find((p) => p.userId === mark.author_id)?.color ?? UNKNOWN_COLOR);
}

function blend(a: string, b: string): string {
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [x, y] = [rgb(a), rgb(b)];
  return '#' + x.map((v, i) => Math.round((v + y[i]) / 2).toString(16).padStart(2, '0')).join('');
}

// Each author's ink on an anchor is their latest coloured mark there; reactions and memories stay in the author's ink.
// A range both partners marked is drawn as an underline in the blend of their inks:
// a blended fill alone can equal a palette colour (red + blue ≈ purple) and read as one person.
export function toPaintMarks(anchors: Anchor[], members: Member[]): PaintMark[] {
  return anchors.map((a) => {
    const authors = [...new Set(a.marks.map((m) => m.author_id))].sort();
    const inkBy = (id: string) => {
      const own = a.marks.filter((m) => m.author_id === id);
      return inkOf([...own].reverse().find((m) => m.color) ?? own[0], members);
    };
    if (authors.length > 1) return { id: a.cfi, locator: a.locator, color: blend(inkBy(authors[0]), inkBy(authors[1])), kind: 'underline' };
    return { id: a.cfi, locator: a.locator, color: inkBy(authors[0]), kind: a.marks.some((m) => m.kind === 'note') ? 'note' : 'highlight' };
  });
}
