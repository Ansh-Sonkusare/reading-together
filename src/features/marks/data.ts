'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { joinChannel } from '../../lib/realtime';
import { createBrowserClient } from '../../lib/supabase';
import type { Database, TablesInsert } from '@/lib/types';
import type { Locator, Pos } from '@/features/reader';
import { groupByAnchor, memoryExt, revealedBy, type Anchor, type Mark, type NewMark } from './model';

type Client = SupabaseClient<Database>;

export async function createMark(db: Client, input: NewMark): Promise<Mark> {
  let row: TablesInsert<'mark'>;
  if (input.kind === 'reply') {
    const { data: parent, error } = await db.from('mark').select('locator, pos').eq('id', input.parentId).single();
    if (error) throw error;
    row = { kind: 'reply', book_id: input.bookId, parent_id: input.parentId, body: input.body, locator: parent.locator, pos: parent.pos };
  } else {
    row = {
      kind: input.kind,
      book_id: input.bookId,
      locator: input.locator,
      pos: input.pos,
      emoji: input.kind === 'reaction' ? input.emoji : null,
      body: input.kind === 'note' || input.kind === 'send' ? input.body : null,
      label: input.kind === 'bookmark' ? input.label : null,
      color: input.kind === 'highlight' || input.kind === 'note' || input.kind === 'bookmark' ? (input.color ?? null) : null,
    };
  }
  const { data, error } = await db.from('mark').insert(row).select().single();
  if (error) throw error;
  return data as Mark;
}

// RLS lets only the author delete. A memory's photo goes after its mark, so a mark never points at a missing photo.
export async function removeMark(db: Client, mark: Pick<Mark, 'id' | 'media_url'>): Promise<void> {
  const { error } = await db.from('mark').delete().eq('id', mark.id);
  if (error) throw error;
  if (mark.media_url) await db.storage.from('memories').remove([mark.media_url]);
}

// A chip click: take my reaction off if I have one with this emoji here, else add it.
// A duplicate insert (a double tap racing itself) already holds the reaction, so it isn't an error.
export async function toggleReaction(db: Client, anchor: Anchor, meId: string, emoji: string): Promise<void> {
  const mine = anchor.marks.find((m) => m.kind === 'reaction' && m.author_id === meId && m.emoji === emoji);
  if (mine) return removeMark(db, mine);
  try {
    await createMark(db, { kind: 'reaction', bookId: anchor.marks[0].book_id, locator: anchor.locator, pos: anchor.pos, emoji });
  } catch (e) {
    if ((e as { code?: string }).code !== '23505') throw e;
  }
}

export type NewMemory = { bookId: string; locator: Locator; pos: Pos; photo: Blob; caption: string | null };

// The photo goes first, to the path the mark will own, so a mark never points at a missing photo;
// a failed insert removes the photo so none is orphaned.
export async function addMemory(db: Client, input: NewMemory): Promise<Mark> {
  const ext = memoryExt(input.photo);
  const { data: coupleId, error: cErr } = await db.rpc('my_couple_id');
  if (cErr) throw cErr;
  const id = crypto.randomUUID();
  const path = `${coupleId}/${id}.${ext}`;
  const bucket = db.storage.from('memories');
  const up = await bucket.upload(path, input.photo, { contentType: input.photo.type });
  if (up.error) throw up.error;
  const { data, error } = await db
    .from('mark')
    .insert({ id, kind: 'memory', book_id: input.bookId, locator: input.locator, pos: input.pos, body: input.caption, media_url: path })
    .select()
    .single();
  if (error) {
    await bucket.remove([path]);
    throw error;
  }
  return data as Mark;
}

// Short-lived: the thread fetches a fresh one each time it renders the photo.
export async function memoryPhotoUrl(db: Client, path: string): Promise<string> {
  const { data, error } = await db.storage.from('memories').createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}

type Change = (marks: Mark[]) => Mark[];

// RLS hides a partner's marks beyond my max_pos, so they only appear on a re-select once I reach them.
// `revealed` is the latest batch that appeared because myMaxPos passed it; the first fetch sets the baseline.
export function useMarks(bookId: string, { myMaxPos }: { myMaxPos: number }): { marks: Mark[]; anchors: Anchor[]; revealed: Mark[] } {
  const [marks, setMarks] = useState<Mark[]>([]);
  const [revealed, setRevealed] = useState<Mark[]>([]);
  const refetch = useRef<() => void>(() => {});
  const maxPos = useRef(myMaxPos);
  useEffect(() => {
    maxPos.current = myMaxPos;
  });

  useEffect(() => {
    const db = createBrowserClient();
    let alive = true;
    // Realtime changes that land while a select is in flight, replayed onto its result.
    let inFlight: Change[] | null = null;
    let fetched: { ids: Set<string>; maxPos: number } | null = null;
    const apply = (change: Change) => {
      inFlight?.push(change);
      setMarks(change);
    };

    refetch.current = async () => {
      const mine: Change[] = (inFlight = []);
      const at = maxPos.current;
      const { data, error } = await db.from('mark').select().eq('book_id', bookId).order('created_at');
      if (!alive || inFlight !== mine) return;
      inFlight = null;
      if (error) return console.error(error);
      const rows = data as Mark[];
      if (fetched) {
        const fresh = revealedBy(fetched, rows);
        if (fresh.length) setRevealed(fresh);
      }
      fetched = { ids: new Set(rows.map((m) => m.id)), maxPos: at };
      setMarks(mine.reduce((ms, change) => change(ms), rows));
    };

    const leave = joinChannel(
      db,
      `marks:${bookId}`,
      (channel) =>
        channel
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mark', filter: `book_id=eq.${bookId}` }, ({ new: m }) =>
            apply((ms) => (ms.some((x) => x.id === m.id) ? ms : [...ms, m as Mark])),
          )
          // DELETE can't be filtered by column; unknown ids are no-ops.
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'mark' }, ({ old }) =>
            apply((ms) => ms.filter((x) => x.id !== old.id)),
          ),
      // Catches marks inserted between the first fetch and the join.
      () => refetch.current(),
    );

    return () => {
      alive = false;
      leave();
    };
  }, [bookId]);

  // max_pos never decreases, so any change is progress past possibly-hidden marks.
  useEffect(() => {
    refetch.current();
  }, [myMaxPos]);

  return { marks, anchors: useMemo(() => groupByAnchor(marks), [marks]), revealed };
}

// Passages the partner sent me, newest first; live while mounted. RLS hides sends past my max_pos like any mark.
export function useInbox(meId: string): Mark[] {
  const [sends, setSends] = useState<Mark[]>([]);
  useEffect(() => {
    const db = createBrowserClient();
    let alive = true;
    const fetchAll = async () => {
      const { data, error } = await db.from('mark').select().eq('kind', 'send').neq('author_id', meId).order('created_at', { ascending: false });
      if (error) return console.error(error);
      if (alive) setSends(data as Mark[]);
    };
    const leave = joinChannel(
      db,
      `inbox:${meId}`,
      (channel) =>
        channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mark' }, ({ new: m }) => {
          if (m.kind === 'send' && m.author_id !== meId) setSends((ss) => (ss.some((x) => x.id === m.id) ? ss : [m as Mark, ...ss]));
        }),
      fetchAll,
    );
    return () => {
      alive = false;
      leave();
    };
  }, [meId]);
  return sends;
}
