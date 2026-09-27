'use client';

import type { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect, useReducer, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Locator, ReaderHandle } from '@/features/reader';
import { joinChannel } from '@/lib/realtime';
import { createBrowserClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { parseSignal, SOLO, step, type Notice, type Signal, type SyncState, type Synced } from './machine';

// A turn across a section boundary relocates through the section start first; only the settled page is sent.
const SETTLE_MS = 150;

const isLocator = (l: unknown): l is Locator => {
  const o = l as Partial<Locator> | null;
  return !!o && typeof o.spine === 'number' && typeof o.offset === 'number' && typeof o.cfi === 'string';
};

// Presence and broadcast on sync:{bookId}. Nothing is stored; the follower's progress still saves through its own relocates.
export function useSync(bookId: string, me: string, reader: ReaderHandle | null) {
  const [{ sync, notice }, dispatch] = useReducer((s: Synced, e: Parameters<typeof step>[1]) => step(s, e, me), { sync: SOLO, notice: null });
  const live = useRef({
    channel: null as RealtimeChannel | null,
    sync: SOLO as SyncState,
    reader: null as ReaderHandle | null,
    last: null as Locator | null,
    want: null as Locator | null,
    chasing: false,
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
  });
  useEffect(() => {
    live.current.sync = sync;
    live.current.reader = reader;
  });

  const [act] = useState(() => {
    const l = live.current;
    const send = (event: string, payload: object) => void l.channel?.send({ type: 'broadcast', event, payload });
    // goTo calls are serialised so a newer page never races an unfinished one.
    const chase = async () => {
      if (l.chasing || !l.reader) return;
      l.chasing = true;
      try {
        while (l.want) {
          const to = l.want;
          l.want = null;
          await l.reader.goTo(to);
        }
      } finally {
        l.chasing = false;
      }
    };
    return {
      send,
      chase,
      signal(type: Signal) {
        dispatch({ type, by: me });
        send('signal', { type, by: me });
      },
      relocated(locator: Locator) {
        l.last = locator;
        if (l.sync.kind !== 'leading') return;
        clearTimeout(l.timer);
        l.timer = setTimeout(() => send('locator', { by: me, locator }), SETTLE_MS);
      },
    };
  });

  useEffect(() => {
    const l = live.current;
    const db = createBrowserClient();
    const leave = joinChannel(
      db,
      `sync:${bookId}`,
      (channel) => {
        l.channel = channel;
        return channel
          .on('presence', { event: 'sync' }, () => {
            const present = Object.values(channel.presenceState<{ userId: string }>()).flatMap((ps) => ps.map((p) => p.userId));
            dispatch({ type: 'presence', present });
          })
          .on('broadcast', { event: 'signal' }, ({ payload }) => {
            const s = parseSignal(payload);
            if (s && s.by !== me) dispatch(s);
          })
          .on('broadcast', { event: 'locator' }, ({ payload }) => {
            const { by, locator } = payload as { by?: unknown; locator?: unknown };
            if (l.sync.kind !== 'following' || l.sync.leader !== by || !isLocator(locator)) return;
            l.want = locator;
            void act.chase();
          });
      },
      () => void l.channel?.track({ userId: me }),
      { private: true },
    );
    return () => {
      clearTimeout(l.timer);
      l.channel = null;
      leave();
    };
  }, [bookId, me, act]);

  useEffect(() => {
    const last = live.current.last;
    if (sync.kind === 'leading' && last) act.send('locator', { by: me, locator: last });
  }, [sync.kind, me, act]);

  return { sync, notice, signal: act.signal, relocated: act.relocated };
}

const NOTICES: Record<Exclude<Notice, null>, (name: string) => string> = {
  youLeft: () => 'You left reading together.',
  theyLeft: (name) => `${name} left reading together.`,
  theyWent: (name) => `${name} left the book.`,
  declined: (name) => `${name} said not now.`,
};

type PillProps = { sync: SyncState; notice: Notice; partnerName: string; partnerColor: string; onSignal: (s: Signal) => void; className?: string };

export function SyncPill({ sync, notice, partnerName, partnerColor, onSignal, className }: PillProps) {
  const dot = <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: partnerColor }} />;
  return (
    <p data-testid="sync-pill" data-state={sync.kind} aria-live="polite" className={cn('relative flex shrink-0 items-center gap-2 text-sm empty:hidden', className)}>
      {sync.kind === 'partnerHere' || sync.kind === 'invited' ? (
        <>
          {dot}
          <span>{partnerName} is here</span>
          {sync.kind === 'partnerHere' && (
            <Button size="sm" variant="outline" onClick={() => onSignal('invite')}>
              Read together now
            </Button>
          )}
        </>
      ) : sync.kind === 'inviting' ? (
        <>
          {dot}
          <span className="text-pencil">Waiting for {partnerName}…</span>
          <Button size="sm" variant="quiet" onClick={() => onSignal('leave')}>
            Cancel
          </Button>
        </>
      ) : sync.kind === 'leading' || sync.kind === 'following' ? (
        <>
          {dot}
          <span>Reading together with {partnerName} ❤️</span>
          <Button size="sm" variant="quiet" onClick={() => onSignal('leave')}>
            Leave
          </Button>
        </>
      ) : null}
      {notice && <span className="absolute top-full right-0 mt-1 whitespace-nowrap rounded-sheet bg-leaf px-2 py-0.5 text-xs text-pencil shadow-float">{NOTICES[notice](partnerName)}</span>}
    </p>
  );
}

export function SyncInvite({ partnerName, partnerColor, onSignal }: { partnerName: string; partnerColor: string; onSignal: (s: Signal) => void }) {
  return (
    <div
      role="dialog"
      aria-label="Read together"
      className="fixed inset-x-4 top-20 z-40 mx-auto flex max-w-md flex-col gap-3 rounded-sheet bg-popover p-4 text-popover-foreground shadow-float"
    >
      <p className="flex items-baseline gap-2.5">
        <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: partnerColor }} />
        <span>
          {partnerName} wants to read together. You&apos;ll follow {partnerName}&apos;s pages.
        </span>
      </p>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="quiet" onClick={() => onSignal('decline')}>
          Not now
        </Button>
        <Button size="sm" onClick={() => onSignal('accept')}>
          Accept
        </Button>
      </div>
    </div>
  );
}
