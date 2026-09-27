import { describe, expect, it } from 'vitest';
import type { Toc } from '../reader';
import { describeDay, groupByDay, memoriesLine, type TimelineEvent } from './timeline';

const ME = 'me';
const SAM = 'sam';
const members = [
  { userId: ME, name: 'Alex' },
  { userId: SAM, name: 'Sam' },
];
const TITLE = 'The Midnight Library';
const at = '2026-09-20T18:00:00Z';

const ev = (type: TimelineEvent['type'], actorId: string, rest: Partial<TimelineEvent> = {}): TimelineEvent => ({
  type,
  actorId,
  createdAt: at,
  data: {},
  ...rest,
});
const highlight = (actorId: string) => ev('mark_created', actorId, { mark: { kind: 'highlight', emoji: null, cfi: `c-${Math.random()}` } });
const react = (actorId: string, cfi: string, emoji: 'love' | 'funny') => ev('mark_created', actorId, { mark: { kind: 'reaction', emoji, cfi } });
const day = (events: TimelineEvent[], meId = ME, toc: Toc | null = null) => describeDay(events, members, meId, TITLE, toc).map((l) => l.text);

describe('describeDay', () => {
  it('writes the idea example day in order', () => {
    expect(
      day([
        ev('book_started', ME),
        ev('book_started', SAM),
        highlight(ME),
        highlight(ME),
        highlight(ME),
        highlight(ME),
        ev('answer_revealed', SAM, { data: { spine: 1, kind: 'question' } }),
        react(SAM, 'x', 'funny'),
        react(ME, 'x', 'love'),
        ev('book_finished', ME),
        ev('book_finished', SAM),
      ]),
    ).toEqual([
      '📖 Started The Midnight Library',
      '❤️ You highlighted 4 passages',
      '😂 You both reacted to the same passage',
      '💬 You discussed Chapter 2',
      '📚 Finished the book together',
    ]);
  });

  it('names the partner when only they acted, and "You" from their side', () => {
    const events = [ev('book_started', SAM), highlight(SAM), ev('book_finished', SAM)];
    expect(day(events)).toEqual(['📖 Sam started The Midnight Library', '❤️ Sam highlighted a passage', '📚 Sam finished the book']);
    expect(day(events, SAM)).toEqual(['📖 You started The Midnight Library', '❤️ You highlighted a passage', '📚 You finished the book']);
  });

  it('says "You both" when both did the same kind of thing, with one total', () => {
    expect(day([highlight(ME), highlight(SAM), highlight(SAM)])).toEqual(['❤️ You both highlighted 3 passages']);
  });

  it('keeps reactions to different passages apart from shared ones', () => {
    expect(day([react(ME, 'x', 'love'), react(SAM, 'y', 'funny')])).toEqual(['❤️ You both reacted to 2 passages']);
    expect(
      day([react(ME, 'x', 'love'), react(SAM, 'x', 'love'), react(ME, 'y', 'funny'), react(SAM, 'y', 'funny'), react(SAM, 'z', 'funny')]),
    ).toEqual(['❤️ You both reacted to the same 2 passages', '😂 Sam reacted to a passage']);
  });

  it('lists several discussed chapters once each, and pluralises notes and replies', () => {
    const q = (spine: number) => ev('answer_revealed', ME, { data: { spine, kind: 'question' } });
    const mark = (kind: 'note' | 'reply') => ev('mark_created', SAM, { mark: { kind, emoji: null, cfi: null } });
    expect(day([q(0), q(2), q(0), mark('note'), mark('note'), mark('reply')])).toEqual([
      '📝 Sam left 2 notes',
      '💬 Sam wrote a reply',
      '💬 You discussed Chapter 1 and Chapter 3',
    ]);
    expect(day([q(0), q(1), q(2)])).toEqual(['💬 You discussed Chapter 1, Chapter 2, and Chapter 3']);
    const toc = [
      { spine: 1, label: 'CHAPTER I. Down the Rabbit-Hole' },
      { spine: 2, label: 'CHAPTER II. The Pool of Tears' },
    ];
    expect(day([q(0), q(1)], ME, toc)).toEqual(['💬 You discussed CHAPTER I. Down the Rabbit-Hole']);
    expect(day([q(2), q(1)], ME, toc)).toEqual(['💬 You discussed CHAPTER I. Down the Rabbit-Hole and CHAPTER II. The Pool of Tears']);
    expect(day([q(0)], ME, toc)).toEqual([]);
  });

  it('says who added a memory, and counts it as one of the memories created', () => {
    const memory = (actorId: string) => ev('mark_created', actorId, { mark: { kind: 'memory', emoji: null, cfi: 'c' } });
    expect(day([memory(SAM)])).toEqual(['📸 Sam added a memory']);
    expect(day([memory(SAM)], SAM)).toEqual(['📸 You added a memory']);
    expect(day([memory(ME), memory(ME)])).toEqual(['📸 You added 2 memories']);
    expect(memoriesLine([memory(SAM), highlight(ME)])).toBe('❤️ 2 memories created');
  });

  it('skips mark events whose mark the viewer cannot read, and ignores chapter_finished', () => {
    expect(day([ev('mark_created', SAM, { mark: null }), ev('chapter_finished', ME, { data: { spine: 0 } })])).toEqual([]);
  });
});

describe('describeDay entries', () => {
  it('carry who they are about and the first passage quoted', () => {
    const quoted = (actorId: string, quote: string) => ev('mark_created', actorId, { mark: { kind: 'highlight', emoji: null, cfi: 'c', quote } });
    expect(describeDay([quoted(SAM, 'Curiouser and curiouser!'), quoted(ME, 'Off with her head!')], members, ME, TITLE, null)).toEqual([
      { text: '❤️ You both highlighted 2 passages', actors: [SAM, ME], quote: 'Curiouser and curiouser!' },
    ]);
    expect(describeDay([ev('answer_revealed', SAM, { data: { spine: 1, kind: 'question' } })], members, ME, TITLE, null)).toEqual([
      { text: '💬 You discussed Chapter 2', actors: [ME, SAM] },
    ]);
  });
});

describe('groupByDay', () => {
  it('splits by the local calendar day of the viewer', () => {
    const events = [
      ev('book_started', ME, { createdAt: '2026-09-20T23:30:00Z' }),
      ev('book_started', SAM, { createdAt: '2026-09-21T01:00:00Z' }),
    ];
    expect(groupByDay(events, 'UTC').map((d) => [d.label, d.events.length])).toEqual([
      ['Sept. 20', 1],
      ['Sept. 21', 1],
    ]);
    expect(groupByDay(events, 'America/New_York').map((d) => [d.label, d.events.length])).toEqual([['Sept. 20', 2]]);
  });
});

describe('memoriesLine', () => {
  it('counts marks and revealed answers', () => {
    expect(memoriesLine([highlight(ME), ev('answer_revealed', SAM), ev('book_started', ME)])).toBe('❤️ 2 memories created');
    expect(memoriesLine([highlight(ME)])).toBe('❤️ 1 memory created');
  });
});
