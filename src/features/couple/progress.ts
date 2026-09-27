'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import type { Database, Json } from '@/lib/types';

export type Progress = Pick<Database['public']['Tables']['progress']['Row'], 'user_id' | 'pos' | 'max_pos' | 'locator'>;

const SAVE_DEBOUNCE_MS = 1000;

type Pending = { pos: number; locator: Json };

// Debounced progress upsert. max_pos only ever rises here (the DB trigger guards it too).
// Saves go through a keepalive fetch so the flush on pagehide survives the unload,
// which a supabase-js request would not.
export function useProgressSaver(bookId: string, userId: string, initial: Progress | null) {
  const [savedPos, setSavedPos] = useState<number | null>(initial?.pos ?? null);
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
        body: JSON.stringify({ user_id: userId, book_id: bookId, pos: p.pos, max_pos: max, locator: p.locator }),
      })
        .then((r) => {
          if (!r.ok) throw new Error(`progress save failed: ${r.status}`);
          setSavedPos(p.pos);
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
        pending = { pos, locator };
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

  return { save: saver.save, savedPos };
}
