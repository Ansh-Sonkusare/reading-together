'use client';

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { InkSwatches } from '@/components/ui/ink';
import { Sheet } from '@/components/ui/sheet';
import { Toast } from '@/components/ui/toast';
import { COLORS, type Color } from '@/features/couple/palette';
import { createBrowserClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { addMemory, memoryPhotoUrl } from './data';
import { BOOKMARK_LABELS, REACTIONS, describe, inkOf, type Anchor, type Mark, type Member, type Reaction } from './model';

const GAP = 8;
const textarea =
  'w-full resize-none rounded-lg border border-rule bg-paper p-2.5 text-base outline-none placeholder:text-pencil focus-visible:border-pencil';

type BodyFormProps = { label: string; submit: string; onSubmit: (body: string) => void; autoFocus?: boolean; optional?: boolean };

function BodyForm({ label, submit, onSubmit, autoFocus, optional }: BodyFormProps) {
  const [body, setBody] = useState('');
  const empty = !optional && !body.trim();
  const send = (e: FormEvent) => {
    e.preventDefault();
    if (empty) return;
    onSubmit(body.trim());
    setBody('');
  };
  return (
    <form onSubmit={send} className="flex flex-col gap-2">
      <textarea
        aria-label={label}
        placeholder={label}
        rows={2}
        autoFocus={autoFocus}
        className={textarea}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
        }}
      />
      <Button type="submit" size="sm" className="self-end" disabled={empty}>
        {submit}
      </Button>
    </form>
  );
}

// Below the selection, else above it, else pinned to the viewport bottom; re-placed as it grows (the note form).
function place(menu: HTMLElement, rect: DOMRect) {
  const { innerWidth: vw, innerHeight: vh } = window;
  const { offsetWidth: w, offsetHeight: h } = menu;
  const below = rect.bottom + GAP;
  const above = rect.top - GAP - h;
  const top = below + h <= vh - GAP ? below : above >= GAP ? above : vh - GAP - h;
  menu.style.top = `${Math.max(GAP, top)}px`;
  menu.style.left = `${Math.max(GAP, Math.min(rect.left, vw - GAP - w))}px`;
}

const INK_KEY = 'marks:ink';
const isInk = (c: string | null | undefined): c is Color => COLORS.includes(c as Color);

// The ink this device last marked in, unless it is the partner's now; else my own.
function lastInk(mine: string, partner?: string): Color | undefined {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(INK_KEY);
  } catch {}
  if (isInk(saved) && saved !== partner) return saved;
  return isInk(mine) ? mine : undefined;
}

export function SelectionMenu({
  rect,
  myColor,
  partnerColor,
  onHighlight,
  onReact,
  onNote,
  onBookmark,
  partnerName,
  onSend,
  onDismiss,
}: {
  rect: DOMRect;
  myColor: string;
  partnerColor?: string;
  onHighlight: (color?: Color) => void;
  onReact: (r: Reaction) => void;
  onNote: (body: string, color?: Color) => void;
  onBookmark: (label: string, color?: Color) => void;
  partnerName?: string;
  onSend: (message: string | null) => void;
  onDismiss: () => void;
}) {
  const [open, setOpen] = useState<'note' | 'bookmark' | 'send' | null>(null);
  const [ink, setInk] = useState(() => lastInk(myColor, partnerColor));
  const pick = (c: string) => {
    if (!isInk(c)) return;
    setInk(c);
    try {
      localStorage.setItem(INK_KEY, c);
    } catch {}
  };
  const toggle = (form: typeof open) => ({ 'aria-expanded': open === form, onClick: () => setOpen(open === form ? null : form) });
  const ref = useRef<HTMLDivElement>(null);
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  });

  useLayoutEffect(() => {
    const menu = ref.current!;
    const reposition = () => place(menu, rect);
    reposition();
    const resize = new ResizeObserver(reposition);
    resize.observe(menu);
    window.addEventListener('resize', reposition);
    return () => {
      resize.disconnect();
      window.removeEventListener('resize', reposition);
    };
  }, [rect]);

  useEffect(() => {
    const menu = ref.current!;
    // Holding focus makes a click into the book's iframe blur this window, the only signal such a click gives us.
    menu.focus({ preventScroll: true });
    const close = () => dismiss.current();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onPointer = (e: PointerEvent) => !menu.contains(e.target as Node) && close();
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', close);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', close);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, []);

  return (
    <div
      ref={ref}
      role="group"
      aria-label="Mark this passage"
      tabIndex={-1}
      className="fixed z-50 flex w-[min(22rem,calc(100vw-1rem))] flex-col gap-2 rounded-sheet border border-rule bg-popover p-3 text-popover-foreground shadow-float outline-none"
    >
      <div className="flex flex-wrap justify-between">
        {REACTIONS.map((r) => (
          <Button key={r.key} variant="quiet" size="icon-lg" className="text-xl" aria-label={r.label} title={r.label} onClick={() => onReact(r.key)}>
            {r.emoji}
          </Button>
        ))}
      </div>
      <InkSwatches
        label="Ink"
        name="mark-ink"
        value={ink ?? myColor}
        onChange={pick}
        exclude={partnerColor ? [partnerColor] : []}
        className="gap-0 border-t border-rule pt-2 [&_label]:size-9 [&_label>span]:size-6 [&_legend]:mb-0"
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => onHighlight(ink)}>
          Highlight
        </Button>
        <Button variant="outline" size="sm" {...toggle('note')}>
          Note
        </Button>
        <Button variant="outline" size="sm" {...toggle('bookmark')}>
          Bookmark
        </Button>
        {partnerName && (
          <Button variant="outline" size="sm" {...toggle('send')}>
            Send to {partnerName}
          </Button>
        )}
      </div>
      {open === 'note' && <BodyForm label="Write a note" submit="Save" onSubmit={(body) => onNote(body, ink)} autoFocus />}
      {open === 'bookmark' && (
        <div role="group" aria-label="Bookmark label" className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1">
            {BOOKMARK_LABELS.map((l) => (
              <Button key={l} variant="quiet" size="sm" className="bg-wash" onClick={() => onBookmark(l, ink)}>
                {l}
              </Button>
            ))}
          </div>
          <BodyForm label="Custom label" submit="Save bookmark" onSubmit={(l) => onBookmark(l, ink)} />
        </div>
      )}
      {open === 'send' && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">This reminded me of you</p>
          <BodyForm label="Add a message (optional)" submit={`Send to ${partnerName}`} onSubmit={(m) => onSend(m || null)} autoFocus optional />
        </div>
      )}
    </div>
  );
}

function MemoryPhoto({ path }: { path: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    memoryPhotoUrl(createBrowserClient(), path).then((url) => alive && setSrc(url), console.error);
    return () => {
      alive = false;
    };
  }, [path]);
  return src ? <img src={src} alt="Memory photo" className="max-h-64 w-full rounded-lg object-cover" /> : <div className="h-40 w-full animate-pulse rounded-lg bg-wash" />;
}

function Line({ mark, members, meId }: { mark: Mark; members: Member[]; meId: string }) {
  const author = members.find((m) => m.userId === mark.author_id);
  const who = mark.author_id === meId ? 'You' : (author?.name ?? 'Reader');
  const ink = inkOf(mark, members);
  if (mark.kind === 'memory') {
    return (
      <li aria-label="Memory" className="flex flex-col gap-2 rounded-lg border-l-4 bg-wash p-2 text-sm" style={{ borderColor: ink }}>
        {mark.media_url && <MemoryPhoto path={mark.media_url} />}
        <p>
          <span className="font-medium">📸 {who}:</span> {mark.body}
        </p>
      </li>
    );
  }
  const reaction = mark.kind === 'reaction' ? REACTIONS.find((r) => r.key === mark.emoji) : undefined;
  const text = reaction ? `${reaction.emoji} ${reaction.label}` : mark.kind === 'highlight' ? 'highlighted this' : mark.body;
  return (
    <li className="flex items-baseline gap-2.5">
      <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: ink }} />
      <p>
        <span className="font-medium">{who}:</span> {text}
      </p>
    </li>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="quiet" size="icon" aria-label="Close" className="absolute top-4 right-4 text-pencil" onClick={onClick}>
      <X />
    </Button>
  );
}

export function ThreadPanel({
  anchor,
  members,
  meId,
  onReply,
  onClose,
}: {
  anchor: Anchor;
  members: Member[];
  meId: string;
  onReply: (body: string) => void;
  onClose: () => void;
}) {
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title="In the margin">
      <CloseButton onClick={onClose} />
      <blockquote className="border-l-2 border-rule pl-3 text-lg leading-relaxed text-pencil">{anchor.locator.quote?.exact}</blockquote>
      <ol className="flex flex-col gap-2">
        {anchor.marks.map((m) => (
          <Line key={m.id} mark={m} members={members} meId={meId} />
        ))}
      </ol>
      {anchor.replies.length > 0 && (
        <ol aria-label="Replies" className="flex flex-col gap-2 border-t border-rule pt-3">
          {anchor.replies.map((m) => (
            <Line key={m.id} mark={m} members={members} meId={meId} />
          ))}
        </ol>
      )}
      <BodyForm label="Reply" submit="Reply" onSubmit={onReply} />
      <MemoryForm anchor={anchor} />
    </Sheet>
  );
}

function MemoryForm({ anchor }: { anchor: Anchor }) {
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [status, setStatus] = useState<{ saving: true } | { error: string } | null>(null);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!photo) return;
    setStatus({ saving: true });
    try {
      await addMemory(createBrowserClient(), { bookId: anchor.marks[0].book_id, locator: anchor.locator, pos: anchor.pos, photo, caption: caption.trim() || null });
      setOpen(false);
      setPhoto(null);
      setCaption('');
      setStatus(null);
    } catch (err) {
      console.error(err);
      setStatus({ error: err instanceof Error ? err.message : "Couldn't save the memory." });
    }
  };
  if (!open) {
    return (
      <Button variant="outline" size="sm" className="self-start" onClick={() => setOpen(true)}>
        Add a memory 📸
      </Button>
    );
  }
  return (
    <form onSubmit={save} aria-label="Add a memory" className="flex flex-col gap-2 border-t border-rule pt-3">
      <input
        type="file"
        accept="image/*"
        aria-label="Photo"
        className="text-sm file:mr-2 file:rounded-full file:border-0 file:bg-wash file:px-3 file:py-1 file:text-foreground"
        onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
      />
      <textarea aria-label="Caption" placeholder="Caption" rows={2} className={textarea} value={caption} onChange={(e) => setCaption(e.target.value)} />
      {status && 'error' in status && (
        <p role="alert" className="text-sm text-danger">
          {status.error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="quiet" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!photo || (status !== null && 'saving' in status)}>
          Save memory
        </Button>
      </div>
    </form>
  );
}

export function RevealToast({
  mark,
  partner,
  onShow,
  onClose,
  className,
}: {
  mark: Mark;
  partner: Member;
  onShow: () => void;
  onClose: () => void;
  className?: string;
}) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const t = setTimeout(() => close.current(), 8000);
    return () => clearTimeout(t);
  }, [mark]);
  return (
    <Toast
      color={partner.color}
      className={cn('py-1.5 pr-1.5', className)}
      action={
        <>
          <Button size="sm" onClick={onShow}>
            Show
          </Button>
          <Button variant="quiet" size="icon" aria-label="Dismiss" className="text-pencil" onClick={onClose}>
            <X />
          </Button>
        </>
      }
    >
      ✨ New from {partner.name}: {describe(mark)}
    </Toast>
  );
}

// A bookmark ribbon: a strip of ink with a notch cut into its tail.
export function Ribbon({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden className={cn('inline-block shrink-0 [clip-path:polygon(0_0,100%_0,100%_100%,50%_75%,0_100%)]', className)} style={{ background: color }} />;
}

export function BookmarksPanel({ bookmarks, members, onGo, onClose }: { bookmarks: Mark[]; members: Member[]; onGo: (m: Mark) => void; onClose: () => void }) {
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title="Bookmarks">
      <CloseButton onClick={onClose} />
      {bookmarks.length === 0 ? (
        <p className="text-muted-foreground">Select a passage and tap Bookmark to keep it here.</p>
      ) : (
        <ul className="-mx-2 flex flex-col gap-1">
          {bookmarks.map((m) => (
            <li key={m.id}>
              <button className="flex w-full gap-3 rounded-lg p-2 text-left transition-colors hover:bg-wash" onClick={() => onGo(m)}>
                <Ribbon color={inkOf(m, members)} className="mt-0.5 h-6 w-3.5" />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-medium">{m.label}</span>
                  <span className="line-clamp-2 font-serif text-sm text-pencil italic">{m.locator?.quote?.exact}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

