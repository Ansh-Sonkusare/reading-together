import { describe, expect, it } from 'vitest';
import { notificationFor, type NotifyEvent, type NotifyMark, type NotifyMember } from './wording';

const SAM = 'sam';
const ALICE = { title: 'Alice', toc: null };
const ALEX = 'alex';
const members: NotifyMember[] = [
  { userId: SAM, name: 'Sam', maxPos: 3.5 },
  { userId: ALEX, name: 'Alex', maxPos: 1.2 },
];
const locator = (exact: string) => ({ spine: 1, offset: 10, cfi: 'epubcfi(/6/4!/4/2,/1:10,/1:30)', quote: { exact, prefix: '', suffix: '' } });
const markEvent = (pos: number, actor = SAM): NotifyEvent => ({ type: 'mark_created', actor_id: actor, book_id: 'b1', pos, data: {} });
const mark = (m: Partial<NotifyMark>): NotifyMark => ({ author_id: SAM, kind: 'highlight', emoji: null, body: null, locator: null, ...m });

describe('notificationFor', () => {
  it('a reaction on the recipient’s own highlight quotes the passage', () => {
    const reaction = mark({ kind: 'reaction', emoji: 'love', locator: locator('Curiouser and curiouser!') });
    const highlight = mark({ author_id: ALEX, kind: 'highlight', locator: locator('Curiouser and curiouser!') });
    expect(notificationFor(markEvent(1.1), reaction, highlight, members, ALEX, ALICE)).toEqual({
      title: '❤️ Sam reacted to your highlight',
      body: '“Curiouser and curiouser!”',
      url: '/book/b1',
    });
  });

  it('a reaction on the recipient’s own note shows the note text', () => {
    const reaction = mark({ kind: 'reaction', emoji: 'funny', locator: locator('the Cheshire Cat') });
    const note = mark({ author_id: ALEX, kind: 'note', body: 'I love this part too!', locator: locator('the Cheshire Cat') });
    expect(notificationFor(markEvent(1.1), reaction, note, members, ALEX, ALICE)).toEqual({
      title: '😂 Sam reacted to your note',
      body: 'I love this part too!',
      url: '/book/b1',
    });
  });

  it('a reply to the recipient’s note shows the reply text', () => {
    const reply = mark({ kind: 'reply', body: 'Same, I laughed out loud' });
    const note = mark({ author_id: ALEX, kind: 'note', body: 'So funny' });
    expect(notificationFor(markEvent(1.1), reply, note, members, ALEX, ALICE)).toEqual({
      title: '💬 Sam replied to your note',
      body: 'Same, I laughed out loud',
      url: '/book/b1',
    });
  });

  it('a new note on a passage', () => {
    const note = mark({ kind: 'note', body: 'This reminds me of our trip', locator: locator('down the rabbit-hole') });
    expect(notificationFor(markEvent(0.5), note, null, members, ALEX, ALICE)).toEqual({
      title: '📝 Sam left a note',
      body: 'This reminds me of our trip',
      url: '/book/b1',
    });
  });

  it('a memory added to a passage shows its caption', () => {
    const memory = mark({ kind: 'memory', body: 'Dinner at our favorite restaurant ❤️', locator: locator('She smiled at him across the table.') });
    expect(notificationFor(markEvent(0.5), memory, null, members, ALEX, ALICE)).toEqual({
      title: '📸 Sam added a memory to a passage',
      body: 'Dinner at our favorite restaurant ❤️',
      url: '/book/b1',
    });
    expect(notificationFor(markEvent(0.5), mark({ ...memory, body: null }), null, members, ALEX, ALICE)?.body).toBe('“She smiled at him across the table.”');
  });

  it('a finished chapter invites the partner', () => {
    const event: NotifyEvent = { type: 'chapter_finished', actor_id: SAM, book_id: 'b1', pos: null, data: { spine: 4 } };
    expect(notificationFor(event, null, null, members, ALEX, ALICE)).toEqual({
      title: '📖 Sam finished Chapter 5',
      body: 'Come read it with me!',
      url: '/book/b1',
    });
  });

  it("names the chapter from the book's TOC, and sends nothing for front matter", () => {
    const book = { title: 'Alice', toc: [{ spine: 2, label: 'CHAPTER I. Down the Rabbit-Hole' }] };
    const finished = (spine: number): NotifyEvent => ({ type: 'chapter_finished', actor_id: SAM, book_id: 'b1', pos: null, data: { spine } });
    const revealed = (spine: number): NotifyEvent => ({ type: 'answer_revealed', actor_id: SAM, book_id: 'b1', pos: null, data: { spine, kind: 'question' } });
    expect(notificationFor(finished(2), null, null, members, ALEX, book)?.title).toBe('📖 Sam finished CHAPTER I. Down the Rabbit-Hole');
    expect(notificationFor(revealed(2), null, null, members, ALEX, book)?.body).toBe('Your answers for CHAPTER I. Down the Rabbit-Hole are revealed');
    expect(notificationFor(finished(1), null, null, members, ALEX, book)).toBeNull();
    expect(notificationFor(revealed(1), null, null, members, ALEX, book)).toBeNull();
  });

  it('a revealed answer links to the discussion', () => {
    const event: NotifyEvent = { type: 'answer_revealed', actor_id: SAM, book_id: 'b1', pos: null, data: { spine: 2, prompt_key: 'q', kind: 'question' } };
    expect(notificationFor(event, null, null, members, ALEX, ALICE)).toEqual({
      title: '💬 Sam answered too',
      body: 'Your answers for Chapter 3 are revealed',
      url: '/discuss/b1/2',
    });
  });

  it('a mark ahead of the recipient sends nothing, one at their max_pos does', () => {
    const note = mark({ kind: 'note', body: 'The Queen!' });
    expect(notificationFor(markEvent(1.3), note, null, members, ALEX, ALICE)).toBeNull();
    expect(notificationFor(markEvent(1.2), note, null, members, ALEX, ALICE)?.title).toBe('📝 Sam left a note');
  });

  it('an event by the recipient sends nothing to them', () => {
    const note = mark({ author_id: ALEX, kind: 'note', body: 'mine' });
    expect(notificationFor(markEvent(0.5, ALEX), note, null, members, ALEX, ALICE)).toBeNull();
    expect(notificationFor(markEvent(0.5, ALEX), note, null, members, SAM, ALICE)?.title).toBe('📝 Alex left a note');
  });

  it('clips a long passage', () => {
    const long = 'a'.repeat(200);
    const body = notificationFor(markEvent(0.5), mark({ locator: locator(long) }), null, members, ALEX, ALICE)?.body;
    expect(body).toBe(`“${'a'.repeat(119)}…”`);
  });
});
