'use client';

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { REACTIONS, type Anchor, type Mark, type Member, type Reaction } from './model';

const GAP = 8;
const textarea =
  'w-full resize-none rounded-lg border border-input bg-background p-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

function BodyForm({ label, submit, onSubmit, autoFocus }: { label: string; submit: string; onSubmit: (body: string) => void; autoFocus?: boolean }) {
  const [body, setBody] = useState('');
  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
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
      <Button type="submit" size="sm" className="self-end" disabled={!body.trim()}>
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
  onDismiss,
}: {
  rect: DOMRect;
  onHighlight: () => void;
  onReact: (r: Reaction) => void;
  onNote: (body: string) => void;
  onDismiss: () => void;
}) {
  const [noting, setNoting] = useState(false);
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
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onHighlight}>
          Highlight
        </Button>
        <Button variant="secondary" aria-expanded={noting} onClick={() => setNoting(!noting)}>
          Note
        </Button>
      </div>
      {noting && <BodyForm label="Write a note" submit="Save" onSubmit={onNote} autoFocus />}
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
