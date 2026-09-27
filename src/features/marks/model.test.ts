import { expect, it } from 'vitest';
import { MEMORY_MAX_BYTES, describe as describeMark, groupByAnchor, memoryExt, revealedBy, inkOf, toPaintMarks, type Mark } from './model';

const A = 'user-a';
const B = 'user-b';
const members = [
  { userId: A, name: 'Alex', color: '#e11d48' },
  { userId: B, name: 'Sam', color: '#2563eb' },
];
const loc1 = { spine: 1, offset: 10, cfi: 'epubcfi(/6/4!/4/2,/1:10,/1:20)', quote: { exact: 'so cute', prefix: '', suffix: '' } };
const loc2 = { spine: 2, offset: 5, cfi: 'epubcfi(/6/6!/4/2,/1:5,/1:9)' };

const mark = (id: string, author: string, created: string, rest: Partial<Mark>): Mark => ({
  id,
  author_id: author,
  book_id: 'book',
  created_at: `2026-09-27T10:00:0${created}Z`,
  kind: 'highlight',
  body: null,
  emoji: null,
  label: null,
  color: null,
  media_url: null,
  parent_id: null,
  locator: null,
  pos: 0,
  ...rest,
});

const noteA = mark('n', A, '1', { kind: 'note', body: 'This part is so cute.', locator: loc1, pos: 1.01 });
const reactB = mark('r', B, '2', { kind: 'reaction', emoji: 'love', locator: loc1, pos: 1.01 });
const replyB = mark('p1', B, '3', { kind: 'reply', body: 'Agreed!', parent_id: 'n', locator: loc1, pos: 1.01 });
const replyA = mark('p2', A, '4', { kind: 'reply', body: 'Right?', parent_id: 'p1', locator: loc1, pos: 1.01 });
const hlA = mark('h', A, '0', { locator: loc2, pos: 2.005 });

it('groups top-level marks by CFI and attaches replies to their root', () => {
  expect(groupByAnchor([replyA, hlA, replyB, reactB, noteA])).toEqual([
    { cfi: loc1.cfi, locator: loc1, pos: 1.01, marks: [noteA, reactB], replies: [replyB, replyA] },
    { cfi: loc2.cfi, locator: loc2, pos: 2.005, marks: [hlA], replies: [] },
  ]);
});

it('drops a reply whose root is hidden', () => {
  expect(groupByAnchor([replyA, hlA])).toEqual([{ cfi: loc2.cfi, locator: loc2, pos: 2.005, marks: [hlA], replies: [] }]);
});

it('paints one mark per anchor, underlined in a blend when both partners marked it', () => {
  expect(toPaintMarks(groupByAnchor([noteA, reactB, replyB, hlA]), members)).toEqual([
    { id: loc1.cfi, locator: loc1, color: '#83409a', kind: 'underline' },
    { id: loc2.cfi, locator: loc2, color: '#e11d48', kind: 'highlight' },
  ]);
});

it("paints each anchor in its author's chosen ink; a note keeps its underline", () => {
  const jadeNote = { ...noteA, color: '#0ca678' };
  const violetHl = { ...hlA, color: '#7048e8' };
  const jadeReact = mark('rj', A, '3', { kind: 'reaction', emoji: 'love', locator: loc2, pos: 2.005 });
  expect(toPaintMarks(groupByAnchor([jadeNote, violetHl, jadeReact]), members)).toEqual([
    { id: loc1.cfi, locator: loc1, color: '#0ca678', kind: 'note' },
    { id: loc2.cfi, locator: loc2, color: '#7048e8', kind: 'highlight' },
  ]);
  expect(toPaintMarks(groupByAnchor([jadeNote, reactB]), members)).toEqual([
    { id: loc1.cfi, locator: loc1, color: '#1985b2', kind: 'underline' },
  ]);
});

it("falls back to the author's ink when a mark has none or holds the partner's ink", () => {
  expect(inkOf({ author_id: A, color: null }, members)).toBe('#e11d48');
  expect(inkOf({ author_id: A, color: '#0ca678' }, members)).toBe('#0ca678');
  expect(inkOf({ author_id: A, color: '#2563eb' }, members)).toBe('#e11d48');
  expect(inkOf({ author_id: 'gone', color: null }, members)).toBe('#9ca3af');
});

const bookmarkA = mark('b', A, '5', { kind: 'bookmark', label: 'Funny part', locator: loc2, pos: 2.005 });
const sendA = mark('s', A, '6', { kind: 'send', body: 'You!', locator: loc2, pos: 2.005 });

it('keeps bookmarks and sends out of the painted anchors', () => {
  expect(groupByAnchor([hlA, bookmarkA, sendA])).toEqual([{ cfi: loc2.cfi, locator: loc2, pos: 2.005, marks: [hlA], replies: [] }]);
});

it('reveals only unseen top-level text marks past the previous max_pos', () => {
  const seen = { ids: new Set(['h']), maxPos: 1.5 };
  const early = mark('e', B, '7', { kind: 'reaction', emoji: 'funny', locator: loc1, pos: 1.01 });
  expect(revealedBy(seen, [early, hlA, noteA, reactB, replyB, bookmarkA, sendA])).toEqual([]);
  const ahead = mark('x', B, '8', { kind: 'reaction', emoji: 'emotional', locator: loc2, pos: 2.005 });
  const aheadNote = mark('y', B, '9', { kind: 'note', body: 'Ha', locator: loc2, pos: 2.005 });
  expect(revealedBy(seen, [hlA, ahead, aheadNote, bookmarkA])).toEqual([ahead, aheadNote]);
  expect([ahead, aheadNote, hlA].map(describeMark)).toEqual(['😭', 'a note', 'a highlight']);
});

it('threads a memory with the passage it was added to, in time order', () => {
  const memoryB = mark('m', B, '5', { kind: 'memory', body: 'Dinner at our favorite restaurant', media_url: 'c/m.jpg', locator: loc2, pos: 2.005 });
  expect(groupByAnchor([memoryB, hlA])).toEqual([{ cfi: loc2.cfi, locator: loc2, pos: 2.005, marks: [hlA, memoryB], replies: [] }]);
  expect(describeMark(memoryB)).toBe('a memory');
});

it('accepts memory photos the bucket accepts and names their extension', () => {
  expect(memoryExt({ type: 'image/jpeg', size: 1000 })).toBe('jpg');
  expect(memoryExt({ type: 'image/heic', size: MEMORY_MAX_BYTES })).toBe('heic');
  expect(() => memoryExt({ type: 'image/gif', size: 1000 })).toThrow('Choose a JPEG, PNG, WebP or HEIC photo.');
  expect(() => memoryExt({ type: 'image/png', size: MEMORY_MAX_BYTES + 1 })).toThrow('Photos can be up to 10 MB.');
});
