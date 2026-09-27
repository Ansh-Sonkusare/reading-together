'use client';

import { useEffect, useState } from 'react';
import { joinChannel } from '@/lib/realtime';
import { createBrowserClient } from '@/lib/supabase';
import type { Database, Json } from '@/lib/types';

export type Progress = Pick<Database['public']['Tables']['progress']['Row'], 'user_id' | 'pos' | 'max_pos' | 'locator'>;

const SAVE_DEBOUNCE_MS = 1000;

type Pending = { pos: number; max: number; locator: Json };

// Debounced progress upsert. max_pos only ever rises here (the DB trigger guards it too).
// Saves go through a keepalive fetch so the flush on pagehide survives the unload,
// which a supabase-js request would not.
export function useProgressSaver(bookId: string, userId: string, initial: Progress | null) {
  const [saved, setSaved] = useState<{ pos: number | null; maxPos: number }>({ pos: initial?.pos ?? null, maxPos: initial?.max_pos ?? 0 });
  const [saver] = useState(() => {
    let token = '';
    let max = initial?.max_pos ?? 0;
    let last = initial?.pos ?? null;
    let pending: Pending | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      clearTimeout(timer);
      const p = pending;
      if (!p) return;
      pending = null;
      fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/progress?on_conflict=user_id,book_id`, {
        method: 'POST',
        keepalive: true,
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({ user_id: userId, book_id: bookId, pos: p.pos, max_pos: p.max, locator: p.locator }),
      })
        .then((r) => {
          if (!r.ok) throw new Error(`progress save failed: ${r.status}`);
          setSaved({ pos: p.pos, maxPos: p.max });
        })
        .catch((e) => {
          console.error(e);
          pending ??= p;
        });
    };
    return {
      setToken: (t: string) => (token = t),
      flush,
      save(pos: number, pageEndPos: number, locator: Json) {
        if (pos === last && pageEndPos <= max) return;
        last = pos;
        max = Math.max(max, pageEndPos);
        pending = { pos, max, locator };
        clearTimeout(timer);
        timer = setTimeout(flush, SAVE_DEBOUNCE_MS);
      },
    };
  });

  useEffect(() => {
    const { data } = createBrowserClient().auth.onAuthStateChange((_, session) => saver.setToken(session?.access_token ?? ''));
    const onHide = () => document.visibilityState === 'hidden' && saver.flush();
    window.addEventListener('pagehide', saver.flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      saver.flush();
      data.subscription.unsubscribe();
      window.removeEventListener('pagehide', saver.flush);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [saver]);

  return { save: saver.save, savedPos: saved.pos, savedMaxPos: saved.maxPos };
}

// The partner's row, kept live over Realtime (RLS limits delivery to the couple).
export function usePartnerProgress(bookId: string, partnerId: string | null, initial: Progress | null): Progress | null {
  const [partner, setPartner] = useState(initial);
  useEffect(() => {
    if (!partnerId) return;
    const db = createBrowserClient();
    const set = (row: Progress) => setPartner({ ...row, pos: Number(row.pos), max_pos: Number(row.max_pos) });
    const catchUp = async () => {
      // Catch an update that landed between the server render and the subscription.
      const { data } = await db.from('progress').select('user_id, pos, max_pos, locator').eq('book_id', bookId).eq('user_id', partnerId).maybeSingle();
      if (data) set(data);
    };
    return joinChannel(
      db,
      `progress:${bookId}`,
      (channel) =>
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'progress', filter: `book_id=eq.${bookId}` }, (payload) => {
          const row = payload.new as Progress;
          if (row.user_id === partnerId) set(row);
        }),
      catchUp,
    );
  }, [bookId, partnerId]);
  return partner;
}
