'use client';

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Avatar } from '@/components/ui/ink';
import { NOTE_MARGIN, THEMES, usePrefs, type MarginSpot, type ReaderHandle } from '@/features/reader';
import { cn } from '@/lib/utils';
import { inkOf, type Anchor, type Mark, type Member } from './model';
import { stack, tilt } from './sticky-layout';

const EDGE = 16;
const WIDE = '(min-width: 1024px)';

const scrollbar =
  'overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:transparent_transparent] hover:[scrollbar-color:color-mix(in_oklab,currentColor_35%,transparent)_transparent] focus-visible:[scrollbar-color:color-mix(in_oklab,currentColor_35%,transparent)_transparent]';

const stuck = new Set<string>();
function stick(el: HTMLElement | null, id: string) {
  if (!el || stuck.has(id)) return;
  stuck.add(id);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  el.animate([{ opacity: 0, scale: '1.06', translate: '0 -6px' }, { opacity: 1, scale: '1', translate: '0 0' }], { duration: 260, easing: 'cubic-bezier(.3,.7,.4,1)' });
}

function useWide() {
  return useSyncExternalStore(
    (cb) => {
      const q = matchMedia(WIDE);
      q.addEventListener('change', cb);
      return () => q.removeEventListener('change', cb);
    },
    () => matchMedia(WIDE).matches,
    () => true,
  );
}

function useSpots(reader: ReaderHandle | null, anchors: Anchor[]) {
  const [spots, setSpots] = useState<Map<string, MarginSpot>>(new Map());
  useEffect(() => {
    if (!reader) return;
    let frame = 0;
    // One read per frame: relocate, resize and a repaint can land together.
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setSpots(reader.spotsFor(anchors.map((a) => a.cfi))));
    };
    measure();
    const off = reader.on('relocate', measure);
    addEventListener('resize', measure);
    return () => {
      off();
      removeEventListener('resize', measure);
      cancelAnimationFrame(frame);
    };
  }, [reader, anchors]);
  return spots;
}

type Note = { mark: Mark; cfi: string; spot: MarginSpot; ink: string; who: string; author: string };
// Paper stuck on the page: a pale wash of the ink over the reading theme's own background and text colours.
type Paper = { background: string; color: string };
const paper = (ink: string, page: Paper) => ({ background: `color-mix(in oklab, ${ink} 16%, ${page.background})`, color: page.color, borderColor: ink });

export function StickyNotes({
  reader,
  anchors,
  members,
  meId,
  onOpen,
}: {
  reader: ReaderHandle | null;
  anchors: Anchor[];
  members: Member[];
  meId: string;
  onOpen: (cfi: string) => void;
}) {
  const wide = useWide();
  const [prefs] = usePrefs();
  const page = { background: prefs.background ?? THEMES[prefs.theme].background, color: THEMES[prefs.theme].color };
  const spots = useSpots(reader, anchors);
  const notes: Note[] = anchors.flatMap((a) => {
    const spot = spots.get(a.cfi);
    if (!spot) return [];
    return a.marks
      .filter((m) => m.kind === 'note' && m.body)
      .map((mark) => {
        const author = members.find((p) => p.userId === mark.author_id)?.name ?? 'Reader';
        return { mark, cfi: a.cfi, spot, ink: inkOf(mark, members), author, who: mark.author_id === meId ? 'You' : author };
      });
  });
  return wide ? <Margin notes={notes} page={page} onOpen={onOpen} /> : <Tabs notes={notes} page={page} onOpen={onOpen} />;
}

function Margin({ notes, page, onOpen }: { notes: Note[]; page: Paper; onOpen: (cfi: string) => void }) {
  const els = useRef(new Map<string, HTMLElement>());
  const key = notes.map((n) => `${n.mark.id}@${n.spot.side}:${n.spot.top}`).join('|');

  // ponytail: only nudges down, so a crowded page can push its last notes past the bottom; stack upward from the page end if that shows up.
  useLayoutEffect(() => {
    for (const side of ['left', 'right'] as const) {
      const placed = notes
        .filter((n) => n.spot.side === side)
        .map((n) => ({ id: n.mark.id, top: n.spot.top - 4, height: els.current.get(n.mark.id)?.offsetHeight ?? 0 }));
      for (const [id, top] of stack(placed)) {
        const el = els.current.get(id);
        if (el) el.style.top = `${top}px`;
      }
    }
    // The key captures every input to the layout; `notes` is rebuilt each render.
  }, [key]);

  return notes.map((n) => (
    <div
      key={n.mark.id}
      ref={(el) => {
        if (el) els.current.set(n.mark.id, el);
        else els.current.delete(n.mark.id);
        stick(el, n.mark.id);
      }}
      role="note"
      aria-label={`${n.who === 'You' ? 'Your' : `${n.author}'s`} note`}
      data-side={n.spot.side}
      onClick={() => onOpen(n.cfi)}
      className="fixed z-20 flex cursor-pointer flex-col gap-1.5 rounded-[3px] border-t-[3px] p-2.5 pt-2 shadow-[0_2px_8px_rgb(38_36_58/.12)]"
      style={{
        top: n.spot.top - 4,
        width: NOTE_MARGIN - 2 * EDGE,
        [n.spot.side]: EDGE,
        rotate: `${tilt(n.mark.id)}deg`,
        ...paper(n.ink, page),
      }}
    >
      <Body note={n} onOpen={onOpen} />
    </div>
  ));
}

function Body({ note, onOpen, className }: { note: Note; onOpen: (cfi: string) => void; className?: string }) {
  return (
    <>
      <button
        type="button"
        aria-label={`Open the thread on ${note.who === 'You' ? 'your' : `${note.author}'s`} note`}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(note.cfi);
        }}
        className="flex items-center gap-2 self-start rounded-full text-left text-sm font-medium"
      >
        <Avatar name={note.author} color={note.ink} size="sm" />
        {note.who}
      </button>
      <p tabIndex={0} className={cn('max-h-[9lh] rounded-[2px] font-sans text-sm leading-5 whitespace-pre-wrap focus-visible:outline-1 focus-visible:outline-offset-2', scrollbar, className)}>
        {note.mark.body}
      </p>
    </>
  );
}

function Tabs({ notes, page, onOpen }: { notes: Note[]; page: Paper; onOpen: (cfi: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const shown = notes.find((n) => n.mark.id === open);

  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [shown]);

  // Several notes on one passage share a tab position; stagger them so each stays tappable.
  const tops = stack(notes.map((n) => ({ id: n.mark.id, top: n.spot.top, height: 28 })), 4);
  return (
    <>
      {notes.map((n) => (
        <button
          key={n.mark.id}
          type="button"
          aria-label={`${n.who === 'You' ? 'Your' : `${n.author}'s`} note`}
          aria-expanded={open === n.mark.id}
          onClick={() => setOpen(open === n.mark.id ? null : n.mark.id)}
          className="fixed right-0 z-20 grid h-7 w-5 place-items-center rounded-l-[3px] shadow-[0_1px_4px_rgb(38_36_58/.18)]"
          style={{ top: tops.get(n.mark.id), background: n.ink }}
        >
          <span aria-hidden className="h-3 w-1.5 rounded-[1px] bg-white/70" />
        </button>
      ))}
      {shown && (
        <>
          <div aria-hidden className="fixed inset-0 z-30" onClick={() => setOpen(null)} />
          <div
            ref={(el) => stick(el, `tab:${shown.mark.id}`)}
            role="note"
            aria-label={`${shown.who === 'You' ? 'Your' : `${shown.author}'s`} note`}
            className="fixed inset-x-4 z-40 mx-auto flex max-w-sm flex-col gap-1.5 rounded-[3px] border-t-[3px] p-3 pt-2.5 shadow-float"
            style={{ top: `min(${shown.spot.bottom + 8}px, 100dvh - 18rem)`, rotate: `${tilt(shown.mark.id)}deg`, ...paper(shown.ink, page) }}
          >
            <Body note={shown} onOpen={onOpen} className="max-h-[12lh]" />
          </div>
        </>
      )}
    </>
  );
}
