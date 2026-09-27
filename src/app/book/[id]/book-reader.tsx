'use client';

import { Bookmark as BookmarkIcon, ChevronLeft, ChevronRight, MessageCircle, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { DuetRibbon, type RibbonMark } from '@/components/ui/duet-ribbon';
import { Toast } from '@/components/ui/toast';
import type { Member } from '@/features/couple/couple';
import { usePartnerProgress, useProgressSaver, type Progress } from '@/features/couple/progress';
import { BookmarksPanel, RevealToast, Ribbon, SelectionMenu, StickyNotes, ThreadPanel, createMark, inkOf, removeMark, toPaintMarks, useMarks, type Mark, type NewMark } from '@/features/marks';
import { createReader, displayPage, pageCount, ReaderPrefs, type Locator, type Pos, type ReaderHandle, type Toc } from '@/features/reader';
import { SyncInvite, SyncPill, useSync } from '@/features/sync';
import { chapterTitle, discussHref } from '@/features/together/discussion';
import { createBrowserClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

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
  const [pageEnd, setPageEnd] = useState<number | null>(null);
  const [mismatch, setMismatch] = useState(false);
  const [failed, setFailed] = useState(false);
  const [turning, setTurning] = useState(false);
  // Once the reader turns a page the top bar recedes; hover, focus or a tap on it brings it back.
  const [reading, setReading] = useState(false);
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
  const onThisPage = pos === null || pageEnd === null ? [] : bookmarks.filter((m) => m.pos >= pos && m.pos <= pageEnd);
  // A partner's mark revealed by reaching it inks in once; mine never animate.
  const fresh = useMemo(() => new Set(revealed.filter((m) => m.author_id === partner?.userId).map((m) => m.locator!.cfi)), [revealed, partner]);

  useEffect(() => {
    const theirs = revealed.filter((m) => m.author_id === partner?.userId);
    if (theirs.length) setToast(theirs[0]);
  }, [revealed, partner]);

  useEffect(() => {
    reader?.paint(toPaintMarks(anchors, members).map((p) => (fresh.has(p.id) ? { ...p, fresh: true } : p)));
  }, [reader, anchors, members, fresh]);

  const mark = (input: NewMark) => {
    setSelection(null);
    reader?.clearSelection();
    setMarkFailed(false);
    createMark(db, input).catch((e) => {
      console.error(e);
      setMarkFailed(true);
    });
  };
  const remove = (m: Mark) => {
    setMarkFailed(false);
    removeMark(db, m).catch((e) => {
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
        setPageEnd(e.pageEndPos);
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
    setReading(true);
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

  const here = pos ?? mine?.pos ?? 0;
  const onRibbon = (m: Member, at: number, isMe: boolean): RibbonMark => {
    const page = displayPage(at, spineLengths);
    return { name: m.name, color: m.color, page, pos: page, isMe };
  };
  const ribbon = [...(partner && theirs ? [onRibbon(partner, theirs.pos, false)] : []), onRibbon(me, here, true)];
  const quiet = cn(buttonVariants({ variant: 'quiet', size: 'sm' }), 'text-pencil hover:text-foreground');

  return (
    <div className="flex h-dvh flex-col bg-paper">
      <header
        data-reading={reading}
        className="z-20 flex flex-wrap items-center gap-x-0.5 px-2 pt-1.5 transition-opacity duration-500 [&[data-reading=true]:not(:hover,:focus-within)]:opacity-35 md:flex-nowrap md:gap-x-1 md:px-4 md:pb-1.5"
      >
        <Link href="/library" className={quiet}>
          <ChevronLeft />
          <span className="max-md:sr-only">Library</span>
        </Link>
        <h1 className="min-w-0 flex-1 truncate px-1 font-serif text-base md:max-w-72 md:flex-none md:text-lg">{title}</h1>
        <div aria-hidden className="order-last basis-full px-3 pt-1 md:order-none md:basis-auto md:flex-1 md:px-6 md:pt-2">
          <DuetRibbon size="sm" total={pageCount(spineLengths)} marks={ribbon} className="md:mx-auto md:max-w-md" />
        </div>
        <p data-testid="progress-pair" className="sr-only">
          {partner && `${theirs ? `${partner.name} p.${displayPage(theirs.pos, spineLengths)}` : `${partner.name} hasn't started`} · `}
          you p.{displayPage(here, spineLengths)}
        </p>
        {partner && <SyncPill sync={sync} notice={notice} partnerName={partner.name} partnerColor={partner.color} onSignal={signal} className="max-md:order-last max-md:w-full max-md:justify-center" />}
        <button className={quiet} aria-expanded={bookmarksOpen} onClick={() => setBookmarksOpen(!bookmarksOpen)}>
          <BookmarkIcon />
          <span className="max-md:sr-only">Bookmarks</span>
        </button>
        {lastChapter !== null && (
          <Link href={discussHref(bookId, Math.floor(pos!) - 1)} aria-label={`Discuss ${lastChapter}`} className={quiet}>
            <MessageCircle />
            <span className="max-md:sr-only">Discuss</span>
          </Link>
        )}
        <details className="relative">
          <summary aria-label="Reading settings" className={cn(quiet, 'cursor-pointer list-none font-serif text-base [&::-webkit-details-marker]:hidden')}>
            Aa
          </summary>
          <div className="absolute top-full right-0 z-30 mt-2 w-72 rounded-sheet border border-rule bg-popover p-4 text-popover-foreground shadow-float">
            <ReaderPrefs handle={reader} />
          </div>
        </details>
      </header>
      {mismatch && (
        <p role="status" className="px-4 py-1 text-center text-xs text-pencil">
          This book renders slightly differently here, so page numbers may be a little off.
        </p>
      )}
      {failed && (
        <p role="alert" className="px-4 py-2 text-center text-danger">
          Could not open this book. Reload to try again.
        </p>
      )}
      <div className="relative min-h-0 flex-1">
        <div ref={container} className="size-full" />
        <ul aria-label="Bookmarks on this page" className="pointer-events-none absolute top-0 right-[12%] flex gap-1">
          {onThisPage.map((m) => (
            <li key={m.id} role="img" aria-label={`Bookmark: ${m.label}`}>
              <Ribbon color={inkOf(m, members)} className="h-10 w-5 drop-shadow-sm" />
            </li>
          ))}
        </ul>
        <StickyNotes
          reader={reader}
          anchors={anchors}
          members={members}
          meId={userId}
          onOpen={(cfi) => {
            setSelection(null);
            setThreadCfi(cfi);
          }}
        />
        {(['prev', 'next'] as const).map((dir) => (
          <button
            key={dir}
            aria-label={dir === 'prev' ? 'Previous page' : 'Next page'}
            disabled={!reader || turning}
            onClick={() => turn(dir)}
            className={cn(
              'group absolute inset-y-0 z-10 flex w-[max(2.75rem,7%)] items-center text-pencil outline-none disabled:cursor-default',
              dir === 'prev' ? 'left-0 justify-start pl-1' : 'right-0 justify-end pr-1',
            )}
          >
            {dir === 'prev' ? <ChevronLeft className={chevron} /> : <ChevronRight className={chevron} />}
          </button>
        ))}
        <output data-testid="my-pos" className="sr-only">
          {pos?.toFixed(6)}
        </output>
        <output data-testid="saved-pos" className="sr-only">
          {savedPos?.toFixed(6)}
        </output>
      </div>
      {markFailed && (
        <p role="alert" className="fixed inset-x-4 top-16 z-50 mx-auto w-fit rounded-full bg-popover px-5 py-2.5 text-sm text-danger shadow-float">
          That didn&apos;t go through. Try again.
        </p>
      )}
      {finished !== null && finishedTitle !== null && (
        // Floats over the page: taking layout space would reflow the book and move page boundaries.
        <aside aria-label="Chapter finished">
          <Toast
            className="z-30 rounded-sheet py-1.5 pr-1.5"
            action={
              <>
                <Link href={discussHref(bookId, finished)} className={buttonVariants({ size: 'sm' })}>
                  Discuss it together
                </Link>
                <Button variant="quiet" size="icon" aria-label="Dismiss" className="text-pencil" onClick={() => setFinished(null)}>
                  <X />
                </Button>
              </>
            }
          >
            You finished <span className="font-serif italic">{finishedTitle}</span>.
          </Toast>
        </aside>
      )}
      {selection && at && (
        <SelectionMenu
          rect={selection.rect}
          myColor={me.color}
          partnerColor={partner?.color}
          onHighlight={(color) => mark({ kind: 'highlight', ...at, color })}
          onReact={(emoji) => mark({ kind: 'reaction', ...at, emoji })}
          onNote={(body, color) => mark({ kind: 'note', ...at, body, color })}
          onBookmark={(label, color) => mark({ kind: 'bookmark', ...at, label, color })}
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
          onRemove={remove}
          onClose={() => setThreadCfi(null)}
        />
      )}
      {bookmarksOpen && (
        <BookmarksPanel
          bookmarks={bookmarks}
          members={members}
          meId={userId}
          onRemove={remove}
          onGo={(m) => {
            setBookmarksOpen(false);
            leaveIfFollowing();
            if (m.locator) reader?.goTo(m.locator);
          }}
          onClose={() => setBookmarksOpen(false)}
        />
      )}
      {sync.kind === 'invited' && partner && <SyncInvite partnerName={partner.name} partnerColor={partner.color} onSignal={signal} />}
      {toast && partner && (
        <RevealToast
          mark={toast}
          partner={partner}
          className={cn('z-30', finished !== null && finishedTitle !== null && 'bottom-24')}
          onShow={() => {
            setToast(null);
            setSelection(null);
            setThreadCfi(toast.locator!.cfi);
          }}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

const chevron = 'size-7 opacity-0 transition-opacity group-hover:opacity-50 group-focus-visible:opacity-100';
