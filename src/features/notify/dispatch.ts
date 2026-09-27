import type { SupabaseClient } from '@supabase/supabase-js';
import type { Locator, Toc } from '@/features/reader';
import type { Database } from '@/lib/types';
import { notificationFor, type NotifyMark } from './wording';

export type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string } };
// Resolves once the push service accepts; rejects with `statusCode` like web-push's WebPushError.
export type Send = (target: PushTarget, payload: string) => Promise<unknown>;

const GONE = new Set([404, 410]);

type MarkRow = NotifyMark & { parent_id: string | null };
const asMark = <T extends { locator: unknown }>(m: T | null): (T & MarkRow) | null =>
  m && ({ ...m, locator: m.locator as Locator | null } as T & MarkRow);

// `db` is a service-role client: the dispatch route has already checked the database's shared secret.
export async function dispatch(db: SupabaseClient<Database>, eventId: string, send: Send): Promise<{ sent: number; removed: number }> {
  const none = { sent: 0, removed: 0 };
  const { data: event } = await db.from('event').select('*').eq('id', eventId).maybeSingle().throwOnError();
  if (!event?.book_id) return none;
  const bookId = event.book_id;

  const [{ data: members }, { data: book }, { data: progress }] = await Promise.all([
    db.from('member').select('user_id, name').eq('couple_id', event.couple_id).throwOnError(),
    db.from('book').select('title, toc').eq('id', bookId).single().throwOnError(),
    db.from('progress').select('user_id, max_pos').eq('book_id', bookId).throwOnError(),
  ]);
  const recipientId = members.find((m) => m.user_id !== event.actor_id)?.user_id;
  if (!recipientId) return none;

  const marks = () => db.from('mark').select('author_id, kind, emoji, body, locator, parent_id');
  const mark =
    event.type === 'mark_created' && event.ref_id
      ? asMark((await marks().eq('id', event.ref_id).maybeSingle().throwOnError()).data)
      : null;
  let parent: MarkRow | null = null;
  if (mark?.parent_id) {
    parent = asMark((await marks().eq('id', mark.parent_id).maybeSingle().throwOnError()).data);
  } else if (mark?.locator) {
    const mine = marks().eq('book_id', bookId).eq('author_id', recipientId).is('parent_id', null).eq('locator->>cfi', mark.locator.cfi);
    parent = asMark((await mine.order('created_at').limit(1).maybeSingle().throwOnError()).data);
  }

  const maxPos = (id: string) => progress.find((p) => p.user_id === id)?.max_pos ?? 0;
  const roster = members.map((m) => ({ userId: m.user_id, name: m.name ?? 'Your partner', maxPos: maxPos(m.user_id) }));
  const note = notificationFor(event, mark, parent, roster, recipientId, { title: book.title, toc: book.toc as Toc | null });
  if (!note) return none;

  const { data: subs } = await db.from('push_sub').select('endpoint, keys').eq('user_id', recipientId).throwOnError();
  const payload = JSON.stringify(note);
  const result = { sent: 0, removed: 0 };
  await Promise.all(
    subs.map(async (s) => {
      try {
        await send({ endpoint: s.endpoint, keys: s.keys as PushTarget['keys'] }, payload);
        result.sent++;
      } catch (e) {
        if (!GONE.has((e as { statusCode?: number }).statusCode ?? 0)) throw e;
        await db.from('push_sub').delete().eq('user_id', recipientId).eq('endpoint', s.endpoint).throwOnError();
        result.removed++;
      }
    }),
  );
  return result;
}
