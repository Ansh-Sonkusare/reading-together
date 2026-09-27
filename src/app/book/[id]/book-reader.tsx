'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Member } from '@/features/couple/couple';
import { usePartnerProgress, useProgressSaver, type Progress } from '@/features/couple/progress';
import { BookmarksPanel, RevealToast, SelectionMenu, ThreadPanel, createMark, toPaintMarks, useMarks, type Mark, type NewMark } from '@/features/marks';
import { createReader, displayPage, ReaderPrefs, type Locator, type Pos, type ReaderHandle, type Toc } from '@/features/reader';
import { SyncInvite, SyncPill, useSync } from '@/features/sync';
import { chapterTitle, discussHref } from '@/features/together/discussion';
import { createBrowserClient } from '@/lib/supabase';

type Selected = { locator: Locator; pos: Pos; rect: DOMRect };

type Props = {
  bookId: string;
  title: string;
  userId: string;
  fileUrl: string;
  spineLengths: number[];
  toc: Toc | null;
  mine: Progress | null;
  me: Member;
  partner: Member | null;
  partnerProgress: Progress | null;
  startAt: Locator | null;
};

export function BookReader({ bookId, title, userId, fileUrl, spineLengths, toc, mine, me, partner, partnerProgress, startAt }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [reader, setReader] = useState<ReaderHandle | null>(null);
  const [pos, setPos] = useState<number | null>(null);
  const [mismatch, setMismatch] = useState(false);
  const [failed, setFailed] = useState(false);
  const [turning, setTurning] = useState(false);
  const [markFailed, setMarkFailed] = useState(false);
  const [selection, setSelection] = useState<Selected | null>(null);
  const [threadCfi, setThreadCfi] = useState<string | null>(null);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [toast, setToast] = useState<Mark | null>(null);
  const [finished, setFinished] = useState<number | null>(null);
  // The furthest spine reached, kept outside the debounced save so a fast page turn can't miss a chapter end.
  const maxSpine = useRef(Math.floor(mine?.max_pos ?? 0));
  const [db] = useState(createBrowserClient);
  const { save, savedPos, savedMaxPos } = useProgressSaver(bookId, userId, mine);
  const theirs = usePartnerProgress(bookId, partner?.userId ?? null, partnerProgress);
  const { marks, anchors, revealed } = useMarks(bookId, { myMaxPos: savedMaxPos });
  const members = useMemo(() => (partner ? [me, partner] : [me]), [me, partner]);
  const thread = anchors.find((a) => a.cfi === threadCfi);
  const { sync, notice, signal, relocated } = useSync(bookId, userId, reader);
  // Moving on your own while following leaves sync; the pill says so.
  const leaveIfFollowing = () => sync.kind === 'following' && signal('leave');

  const finishedTitle = finished === null ? null : chapterTitle(toc, finished);
  const lastChapter = pos === null || pos < 1 ? null : chapterTitle(toc, Math.floor(pos) - 1);

  const bookmarks = useMemo(() => marks.filter((m) => m.kind === 'bookmark'), [marks]);

  useEffect(() => {
    const theirs = revealed.filter((m) => m.author_id === partner?.userId);
    if (theirs.length) setToast(theirs[0]);
  }, [revealed, partner]);

  useEffect(() => {
    reader?.paint(toPaintMarks(anchors, members));
  }, [reader, anchors, members]);

  const mark = (input: NewMark) => {
    setSelection(null);
    reader?.clearSelection();
    setMarkFailed(false);
    createMark(db, input).catch((e) => {
      console.error(e);
      setMarkFailed(true);
    });
  };
  const at = selection && { bookId, locator: selection.locator, pos: selection.pos };

  useEffect(() => {
    let handle: ReaderHandle | undefined;
    let cancelled = false;
    (async () => {
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error(`book download failed: ${res.status}`);
      const r = await createReader(container.current!, await res.blob(), { spineLengths });
      if (cancelled) return r.destroy();
      handle = r;
      let warned = false;
      r.on('lengthMismatch', (e) => {
        if (warned) return;
        warned = true;
        console.warn('spine length differs from the upload-time length; positions may drift', e);
        setMismatch(true);
      });
      r.on('relocate', (e) => {
        setPos(e.pos);
        if (e.spine > maxSpine.current) {
          maxSpine.current = e.spine;
          setFinished(e.spine - 1);
        }
        save(e.pos, e.pageEndPos, e.locator);
        relocated(e.locator);
      });
      r.on('select', ({ locator, pos, rect }) => setSelection({ locator, pos, rect }));
      r.on('markClick', ({ id }) => {
        setSelection(null);
        setThreadCfi(id);
      });
      const start = startAt ?? (mine?.locator as Locator | null);
      await (start ? r.goTo(start) : r.goTo((mine?.pos ?? 0) as Pos));
      setReader(r);
    })().catch((e) => {
      console.error(e);
      setFailed(true);
    });
    return () => {
      cancelled = true;
      handle?.destroy();
    };
    // The reader is created once per page load; later prop changes don't re-open the book.
  }, []);

  // foliate drops a turn requested while the previous one is still animating.
  const turn = async (dir: 'prev' | 'next') => {
    if (!reader || turning) return;
    leaveIfFollowing();
    setTurning(true);
    try {
      await reader[dir]();
    } finally {
      setTurning(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') turn('prev');
      else if (e.key === 'ArrowRight') turn('next');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 border-b px-3 py-2 text-sm">
        <Link href="/library" className="underline">
          Library
        </Link>
        <h1 className="truncate font-semibold">{title}</h1>
        {partner && <SyncPill sync={sync} notice={notice} partnerName={partner.name} onSignal={signal} />}
        <button className="ml-auto shrink-0 underline" aria-expanded={bookmarksOpen} onClick={() => setBookmarksOpen(!bookmarksOpen)}>
          Bookmarks
        </button>
        {lastChapter !== null && (
          <Link href={discussHref(bookId, Math.floor(pos!) - 1)} className="shrink-0 underline">
            Discuss {lastChapter}
          </Link>
        )}
        <p data-testid="progress-pair" className="shrink-0 font-medium">
          {partner && (
            <>
              <span style={{ color: partner.color }}>
                {theirs ? `${partner.name} p.${displayPage(theirs.pos, spineLengths)}` : `${partner.name} hasn't started`}
              </span>
              {' · '}
            </>
          )}
          <span style={{ color: me.color }}>you p.{displayPage(pos ?? mine?.pos ?? 0, spineLengths)}</span>
        </p>
      </header>
      {mismatch && (
        <p role="status" className="bg-amber-50 px-3 py-1 text-xs text-amber-800">
          This book renders slightly differently here, so page numbers may be a little off.
        </p>
      )}
      {failed && (
        <p role="alert" className="px-3 py-1 text-sm text-red-600">
          Could not open this book. Reload to try again.
        </p>
      )}
      {markFailed && (
        <p role="alert" className="px-3 py-1 text-sm text-red-600">
          Could not save that. Try again.
        </p>
      )}
      {finished !== null && finishedTitle !== null && (
        // Floats over the page: taking layout space would reflow the book and move page boundaries.
        <aside
          aria-label="Chapter finished"
          className="fixed inset-x-0 bottom-14 z-30 mx-auto flex w-fit max-w-[calc(100vw-1rem)] items-center gap-2 rounded-full border bg-rose-50 py-1 pr-1 pl-4 text-sm shadow-lg"
        >
          <span>You finished {finishedTitle}.</span>
          <Link href={discussHref(bookId, finished)} className="font-medium underline">
            Discuss it together →
          </Link>
          <button aria-label="Dismiss" className="ml-auto px-1" onClick={() => setFinished(null)}>
            ×
          </button>
        </aside>
      )}
      <div ref={container} className="min-h-0 flex-1" />
      {selection && at && (
        <SelectionMenu
          rect={selection.rect}
          onHighlight={() => mark({ kind: 'highlight', ...at })}
          onReact={(emoji) => mark({ kind: 'reaction', ...at, emoji })}
          onNote={(body) => mark({ kind: 'note', ...at, body })}
          onBookmark={(label) => mark({ kind: 'bookmark', ...at, label })}
          partnerName={partner?.name}
          onSend={(body) => mark({ kind: 'send', ...at, body })}
          onDismiss={() => setSelection(null)}
        />
      )}
      {thread && (
        <ThreadPanel
          anchor={thread}
          members={members}
          meId={userId}
          onReply={(body) => mark({ kind: 'reply', bookId, parentId: thread.marks[0].id, body })}
          onClose={() => setThreadCfi(null)}
        />
      )}
      {bookmarksOpen && (
        <BookmarksPanel
          bookmarks={bookmarks}
          members={members}
          onGo={(m) => {
            setBookmarksOpen(false);
            leaveIfFollowing();
            if (m.locator) reader?.goTo(m.locator);
          }}
          onClose={() => setBookmarksOpen(false)}
        />
      )}
      {sync.kind === 'invited' && partner && <SyncInvite partnerName={partner.name} onSignal={signal} />}
      {toast && partner && (
        <RevealToast
          mark={toast}
          partner={partner}
          onShow={() => {
            setToast(null);
            setSelection(null);
            setThreadCfi(toast.locator!.cfi);
          }}
          onClose={() => setToast(null)}
        />
      )}
      <footer className="flex items-center justify-between gap-3 border-t px-3 py-2 text-sm">
        <button aria-label="Previous page" disabled={!reader || turning} onClick={() => turn('prev')} className="px-2 disabled:opacity-40">
          ‹
        </button>
        <span className="flex items-center gap-3">
          <span>{pos === null ? '' : `p.${displayPage(pos, spineLengths)}`}</span>
          <output data-testid="my-pos" className="sr-only">
            {pos?.toFixed(6)}
          </output>
          <output data-testid="saved-pos" className="sr-only">
            {savedPos?.toFixed(6)}
          </output>
          <details className="relative">
            <summary aria-label="Reading settings" className="cursor-pointer select-none px-1">Aa</summary>
            <div className="absolute bottom-8 right-0 z-20 rounded-md border bg-background p-2 shadow">
              <ReaderPrefs handle={reader} />
            </div>
          </details>
        </span>
        <button aria-label="Next page" disabled={!reader || turning} onClick={() => turn('next')} className="px-2 disabled:opacity-40">
          ›
        </button>
      </footer>
    </div>
  );
}
