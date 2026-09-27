'use client';

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useInbox } from './data';
import { BOOKMARK_LABELS, REACTIONS, describe, type Anchor, type Mark, type Member, type Reaction } from './model';

const GAP = 8;
const textarea =
  'w-full resize-none rounded-lg border border-input bg-background p-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

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

export function SelectionMenu({
  rect,
  onHighlight,
  onReact,
  onNote,
  onBookmark,
  partnerName,
  onSend,
  onDismiss,
}: {
  rect: DOMRect;
  onHighlight: () => void;
  onReact: (r: Reaction) => void;
  onNote: (body: string) => void;
  onBookmark: (label: string) => void;
  partnerName?: string;
  onSend: (message: string | null) => void;
  onDismiss: () => void;
}) {
  const [open, setOpen] = useState<'note' | 'bookmark' | 'send' | null>(null);
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
      className="fixed z-50 flex w-[min(22rem,calc(100vw-1rem))] flex-col gap-2 rounded-xl border bg-background p-2 text-foreground shadow-lg outline-none"
    >
      <div className="flex flex-wrap gap-1">
        {REACTIONS.map((r) => (
          <Button key={r.key} variant="ghost" size="icon-lg" className="text-xl" aria-label={r.label} title={r.label} onClick={() => onReact(r.key)}>
            {r.emoji}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onHighlight}>
          Highlight
        </Button>
        <Button variant="secondary" {...toggle('note')}>
          Note
        </Button>
        <Button variant="secondary" {...toggle('bookmark')}>
          Bookmark
        </Button>
        {partnerName && (
          <Button variant="secondary" {...toggle('send')}>
            Send to {partnerName}
          </Button>
        )}
      </div>
      {open === 'note' && <BodyForm label="Write a note" submit="Save" onSubmit={onNote} autoFocus />}
      {open === 'bookmark' && (
        <div role="group" aria-label="Bookmark label" className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1">
            {BOOKMARK_LABELS.map((l) => (
              <Button key={l} variant="outline" size="sm" onClick={() => onBookmark(l)}>
                {l}
              </Button>
            ))}
          </div>
          <BodyForm label="Custom label" submit="Save bookmark" onSubmit={onBookmark} />
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

function Line({ mark, members, meId }: { mark: Mark; members: Member[]; meId: string }) {
  const author = members.find((m) => m.userId === mark.author_id);
  const reaction = mark.kind === 'reaction' ? REACTIONS.find((r) => r.key === mark.emoji) : undefined;
  const text = reaction ? `${reaction.emoji} ${reaction.label}` : mark.kind === 'highlight' ? 'highlighted this' : mark.body;
  return (
    <li className="flex items-baseline gap-2 text-sm">
      <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: author?.color ?? '#9ca3af' }} />
      <p>
        <span className="font-medium">{mark.author_id === meId ? 'You' : (author?.name ?? 'Reader')}:</span> {text}
      </p>
    </li>
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
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <section
      aria-label="Thread"
      className="fixed inset-x-0 bottom-0 z-50 flex max-h-[70dvh] flex-col gap-3 overflow-y-auto rounded-t-xl border bg-background p-4 text-foreground shadow-lg md:inset-x-auto md:right-4 md:bottom-4 md:w-96 md:rounded-xl"
    >
      <div className="flex items-start justify-between gap-2">
        <blockquote className="border-l-2 pl-3 text-sm italic text-muted-foreground">{anchor.locator.quote?.exact}</blockquote>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          ✕
        </Button>
      </div>
      <ol className="flex flex-col gap-2">
        {anchor.marks.map((m) => (
          <Line key={m.id} mark={m} members={members} meId={meId} />
        ))}
      </ol>
      {anchor.replies.length > 0 && (
        <ol aria-label="Replies" className="flex flex-col gap-2 border-t pt-2">
          {anchor.replies.map((m) => (
            <Line key={m.id} mark={m} members={members} meId={meId} />
          ))}
        </ol>
      )}
      <BodyForm label="Reply" submit="Reply" onSubmit={onReply} />
    </section>
  );
}

export function RevealToast({ mark, partner, onShow, onClose }: { mark: Mark; partner: Member; onShow: () => void; onClose: () => void }) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const t = setTimeout(() => close.current(), 8000);
    return () => clearTimeout(t);
  }, [mark]);
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-14 z-40 mx-auto flex w-fit max-w-[calc(100vw-1rem)] items-center gap-3 rounded-full border bg-background py-1 pr-1 pl-4 text-sm text-foreground shadow-lg"
    >
      <span>
        ✨ New from <span style={{ color: partner.color }}>{partner.name}</span>: {describe(mark)}
      </span>
      <Button size="sm" onClick={onShow}>
        Show
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={onClose}>
        ✕
      </Button>
    </div>
  );
}

export function BookmarksPanel({ bookmarks, members, onGo, onClose }: { bookmarks: Mark[]; members: Member[]; onGo: (m: Mark) => void; onClose: () => void }) {
  return (
    <section
      aria-label="Bookmarks"
      className="fixed inset-x-0 bottom-0 z-50 flex max-h-[70dvh] flex-col gap-3 overflow-y-auto rounded-t-xl border bg-background p-4 text-foreground shadow-lg md:inset-x-auto md:top-14 md:right-4 md:bottom-auto md:w-96 md:rounded-xl"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Bookmarks</h2>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          ✕
        </Button>
      </div>
      {bookmarks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Select a passage and tap Bookmark to keep it here.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {bookmarks.map((m) => (
            <li key={m.id}>
              <button className="flex w-full flex-col gap-1 rounded-lg p-2 text-left hover:bg-muted" onClick={() => onGo(m)}>
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span aria-hidden className="size-2.5 rounded-full" style={{ background: members.find((p) => p.userId === m.author_id)?.color }} />
                  {m.label}
                </span>
                <span className="line-clamp-2 text-sm italic text-muted-foreground">{m.locator?.quote?.exact}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Inbox({ meId, partner, books }: { meId: string; partner: Member; books: { id: string; title: string }[] }) {
  const sends = useInbox(meId);
  return (
    <section aria-label={`From ${partner.name}`} className="flex flex-col gap-3">
      <h2 className="font-semibold">From {partner.name}</h2>
      {sends.length === 0 ? (
        <p className="text-sm text-muted-foreground">When {partner.name} sends you a passage, it lands here.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sends.map((m) => (
            <li key={m.id} className="flex flex-col gap-1 rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">This reminded me of you</p>
              <blockquote className="border-l-2 pl-3 text-sm italic" style={{ borderColor: partner.color }}>
                {m.locator?.quote?.exact}
              </blockquote>
              {m.body && <p className="text-sm">{m.body}</p>}
              <Link href={`/book/${m.book_id}?mark=${m.id}`} className="self-start text-sm underline">
                Open in {books.find((b) => b.id === m.book_id)?.title ?? 'the book'}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
