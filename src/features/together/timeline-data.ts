import 'server-only';
import type { Locator } from '@/features/reader';
import { createUserClient } from '@/lib/supabase-server';
import type { TimelineEvent } from './timeline';

// Both queries run as the viewer, so RLS drops events and marks ahead of them (D9).
export async function getTimeline(bookId: string): Promise<{ title: string; events: TimelineEvent[] } | null> {
  const db = await createUserClient();
  const [{ data: book }, { data: events, error }] = await Promise.all([
    db.from('book').select('title').eq('id', bookId).maybeSingle(),
    db.from('event').select('type, actor_id, created_at, data, ref_id').eq('book_id', bookId).order('created_at'),
  ]);
  if (error) throw error;
  if (!book) return null;
  const markIds = events.filter((e) => e.type === 'mark_created' && e.ref_id).map((e) => e.ref_id!);
  const { data: marks, error: mErr } = markIds.length
    ? await db.from('mark').select('id, kind, emoji, locator').in('id', markIds)
    : { data: [], error: null };
  if (mErr) throw mErr;
  const byId = new Map(marks.map((m) => [m.id, m]));
  return {
    title: book.title,
    events: events.map((e) => {
      const m = e.ref_id ? byId.get(e.ref_id) : undefined;
      return {
        type: e.type,
        actorId: e.actor_id,
        createdAt: e.created_at,
        data: e.data as TimelineEvent['data'],
        mark: m ? { kind: m.kind, emoji: m.emoji, cfi: (m.locator as Locator | null)?.cfi ?? null } : null,
      };
    }),
  };
}
