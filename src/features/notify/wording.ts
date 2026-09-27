import type { Locator, Toc } from '@/features/reader';
import { chapterTitle, discussHref } from '../together/discussion';
import type { Tables } from '@/lib/types';

export type NotifyEvent = Pick<Tables<'event'>, 'type' | 'actor_id' | 'book_id' | 'pos' | 'data'>;
export type NotifyMark = Pick<Tables<'mark'>, 'author_id' | 'kind' | 'emoji' | 'body'> & { locator: Locator | null };
// maxPos is the member's progress.max_pos in the event's book.
export type NotifyMember = { userId: string; name: string; maxPos: number };
export type Notification = { title: string; body: string; url: string };

const MAX_BODY = 120;
const clip = (s: string) => (s.length > MAX_BODY ? `${s.slice(0, MAX_BODY - 1).trimEnd()}…` : s);
const quoted = (m: NotifyMark | null) => (m?.locator?.quote?.exact ? `“${clip(m.locator.quote.exact.trim())}”` : '');
const textOf = (m: NotifyMark | null) => (m?.body ? clip(m.body) : quoted(m));
const noun = (m: NotifyMark) => (m.kind === 'note' || m.kind === 'reply' ? 'note' : 'highlight');

// `parent` is the mark this one answers: a reply's parent_id, or for a reaction the
// recipient's own mark on the same passage. Returns null when nothing should be sent.
export function notificationFor(
  event: NotifyEvent,
  mark: NotifyMark | null,
  parent: NotifyMark | null,
  members: NotifyMember[],
  recipientId: string,
  { title: bookTitle, toc }: { title: string; toc: Toc | null },
): Notification | null {
  const actor = members.find((m) => m.userId === event.actor_id);
  const recipient = members.find((m) => m.userId === recipientId);
  if (!actor || !recipient || actor === recipient || !event.book_id) return null;
  const name = actor.name;
  const book = `/book/${event.book_id}`;
  const spine = (event.data as { spine?: number } | null)?.spine ?? 0;
  // Front matter has no chapter name, so its chapter_finished and answer_revealed events push nothing.
  const chapter = chapterTitle(toc, spine);
  if (chapter === null && (event.type === 'chapter_finished' || event.type === 'answer_revealed')) return null;

  switch (event.type) {
    case 'chapter_finished':
      return { title: `📖 ${name} finished ${chapter}`, body: 'Come read it with me!', url: book };
    case 'book_finished':
      return { title: `🎉 ${name} finished ${bookTitle}`, body: 'Come finish it with me!', url: book };
    case 'answer_revealed':
      return { title: `💬 ${name} answered too`, body: `Your answers for ${chapter} are revealed`, url: discussHref(event.book_id, spine) };
    case 'mark_created':
      break;
    default:
      return null;
  }

  if (!mark || event.pos == null || event.pos > recipient.maxPos) return null;
  const mine = parent?.author_id === recipientId ? parent : null;
  switch (mark.kind) {
    case 'reaction': {
      return mine
        ? { title: `${mark.emoji ?? '❤️'} ${name} reacted to your ${noun(mine)}`, body: textOf(mine), url: book }
        : { title: `${mark.emoji ?? '❤️'} ${name} reacted to a passage`, body: quoted(mark), url: book };
    }
    case 'reply':
      return { title: mine ? `💬 ${name} replied to your ${noun(mine)}` : `💬 ${name} replied`, body: textOf(mark), url: book };
    case 'note':
      return { title: `📝 ${name} left a note`, body: textOf(mark), url: book };
    case 'highlight':
      return { title: `✨ ${name} highlighted a passage`, body: quoted(mark), url: book };
    case 'send':
      return { title: `📨 ${name} sent you a passage`, body: textOf(mark), url: book };
    case 'memory':
      return { title: `📸 ${name} added a memory to a passage`, body: textOf(mark), url: book };
    case 'bookmark':
      return null;
  }
}
