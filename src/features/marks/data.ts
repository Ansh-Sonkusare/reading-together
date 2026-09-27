import { useEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { joinChannel } from '../../lib/realtime';
import { createBrowserClient } from '../../lib/supabase';
import type { Database, TablesInsert } from '@/lib/types';
import { groupByAnchor, type Anchor, type Mark, type NewMark } from './model';

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
      body: input.kind === 'note' ? input.body : null,
    };
  }
  const { data, error } = await db.from('mark').insert(row).select().single();
  if (error) throw error;
  return data as Mark;
}

type Change = (marks: Mark[]) => Mark[];

// RLS hides a partner's marks beyond my max_pos, so they only appear on a re-select once I reach them.
export function useMarks(bookId: string, { myMaxPos }: { myMaxPos: number }): { marks: Mark[]; anchors: Anchor[] } {
  const [marks, setMarks] = useState<Mark[]>([]);
  const refetch = useRef<() => void>(() => {});

  useEffect(() => {
    const db = createBrowserClient();
    let alive = true;
    // Realtime changes that land while a select is in flight, replayed onto its result.
    let inFlight: Change[] | null = null;
    const apply = (change: Change) => {
      inFlight?.push(change);
      setMarks(change);
    };

    refetch.current = async () => {
      const mine: Change[] = (inFlight = []);
      const { data, error } = await db.from('mark').select().eq('book_id', bookId).order('created_at');
      if (!alive || inFlight !== mine) return;
      inFlight = null;
      if (error) return console.error(error);
      setMarks(mine.reduce((ms, change) => change(ms), data as Mark[]));
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

  return { marks, anchors: useMemo(() => groupByAnchor(marks), [marks]) };
}
