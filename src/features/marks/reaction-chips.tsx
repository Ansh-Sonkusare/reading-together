'use client';

import { Popover } from '@base-ui/react/popover';
import { EmojiPicker } from 'frimousse';
import { SmilePlus } from 'lucide-react';
import { useRef, useState, useSyncExternalStore } from 'react';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { canRemove, reactionChips, type Anchor, type Member } from './model';

const RECENT_KEY = 'reactions:recent';
const LONG_PRESS_MS = 450;

function recentEmoji(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((e) => typeof e === 'string').slice(0, 8) : [];
  } catch {
    return [];
  }
}

function remember(emoji: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([emoji, ...recentEmoji().filter((e) => e !== emoji)].slice(0, 8)));
  } catch {}
}

const cell = 'flex size-9 items-center justify-center rounded-lg text-xl data-[active]:bg-wash hover:bg-wash';

/** Search, recent and every emoji by category. Emoji data comes from the emojibase CDN on first open, then the browser caches it. */
export function EmojiPanel({ onPick, className }: { onPick: (emoji: string) => void; className?: string }) {
  const [recent] = useState(recentEmoji);
  const pick = (emoji: string) => {
    remember(emoji);
    onPick(emoji);
  };
  return (
    <EmojiPicker.Root onEmojiSelect={({ emoji }) => pick(emoji)} columns={8} className={cn('flex h-80 w-full flex-col gap-2', className)}>
      <EmojiPicker.Search
        aria-label="Search emoji"
        placeholder="Search emoji"
        autoFocus
        className="w-full rounded-lg border border-rule bg-paper px-2.5 py-1.5 text-base outline-none placeholder:text-pencil focus-visible:border-pencil"
      />
      {recent.length > 0 && (
        <div role="group" aria-label="Recent" className="flex flex-col gap-1">
          <p className="text-xs text-pencil">Recent</p>
          <div className="flex flex-wrap">
            {recent.map((e) => (
              <button key={e} type="button" className={cell} onClick={() => pick(e)}>
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
      <EmojiPicker.Viewport className="relative min-h-0 flex-1 outline-none">
        <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-sm text-pencil">Loading…</EmojiPicker.Loading>
        <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-sm text-pencil">No emoji found.</EmojiPicker.Empty>
        <EmojiPicker.List
          className="select-none"
          components={{
            CategoryHeader: ({ category, ...props }) => (
              <div {...props} className="bg-popover pt-2 pb-1 text-xs text-pencil">
                {category.label}
              </div>
            ),
            Row: ({ children, ...props }) => (
              <div {...props} className="flex">
                {children}
              </div>
            ),
            Emoji: ({ emoji, ...props }) => (
              <button {...props} className={cell}>
                {emoji.emoji}
              </button>
            ),
          }}
        />
      </EmojiPicker.Viewport>
    </EmojiPicker.Root>
  );
}

const WIDE = '(min-width: 768px)';
const subscribe = (cb: () => void) => {
  const q = window.matchMedia(WIDE);
  q.addEventListener('change', cb);
  return () => q.removeEventListener('change', cb);
};
const useWide = () => useSyncExternalStore(subscribe, () => window.matchMedia(WIDE).matches, () => true);

const chip = 'inline-flex h-7 items-center gap-1 rounded-full border px-2 text-sm tabular-nums transition-colors';

/** A popover on desktop, a bottom sheet on phones. */
function AddReaction({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const wide = useWide();
  const choose = (e: string) => {
    setOpen(false);
    onPick(e);
  };
  const trigger = cn(chip, 'border-rule bg-transparent text-pencil hover:bg-wash hover:text-foreground aria-expanded:bg-wash');
  if (!wide) {
    return (
      <>
        <button type="button" aria-label="Add reaction" aria-expanded={open} className={trigger} onClick={() => setOpen(true)}>
          <SmilePlus className="size-4" />
        </button>
        <Sheet open={open} onOpenChange={setOpen} title="Add a reaction">
          {open && <EmojiPanel onPick={choose} />}
        </Sheet>
      </>
    );
  }
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger aria-label="Add reaction" className={trigger}>
        <SmilePlus className="size-4" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} className="z-50">
          <Popover.Popup aria-label="Add a reaction" className="w-80 rounded-sheet border border-rule bg-popover p-3 text-popover-foreground shadow-float outline-none">
            <EmojiPanel onPick={choose} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * Discord-style chips for one passage: emoji + count, pressed if I reacted, a click toggles mine.
 * Hover or long-press shows who reacted. A reaction the partner replied under can't be taken off (canRemove).
 */
export function ReactionChips({
  anchor,
  members,
  meId,
  onToggle,
  className,
}: {
  anchor: Anchor;
  members: Member[];
  meId: string;
  onToggle: (emoji: string) => void;
  className?: string;
}) {
  const [who, setWho] = useState<string | null>(null);
  const press = useRef<{ timer: number; long: boolean } | null>(null);
  const all = [...anchor.marks, ...anchor.replies];
  const myInk = members.find((m) => m.userId === meId)?.color;
  const chips = reactionChips(anchor, members, meId);

  return (
    <div role="group" aria-label="Reactions" className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {chips.map((c) => {
        const locked = c.mine && !canRemove(c.mine, all, meId);
        return (
          <span key={c.emoji} className="relative">
            <button
              type="button"
              aria-pressed={!!c.mine}
              aria-label={`${c.emoji} ${c.count}: ${c.names.join(', ')}`}
              aria-disabled={locked || undefined}
              className={cn(chip, c.mine ? 'bg-wash' : 'border-rule bg-leaf hover:bg-wash', locked && 'cursor-default')}
              style={c.mine && myInk ? { borderColor: myInk } : undefined}
              onPointerEnter={(e) => e.pointerType === 'mouse' && setWho(c.emoji)}
              onPointerLeave={() => setWho(null)}
              onPointerDown={(e) => {
                if (e.pointerType === 'mouse') return;
                const p = { long: false, timer: 0 };
                p.timer = window.setTimeout(() => {
                  p.long = true;
                  setWho(c.emoji);
                }, LONG_PRESS_MS);
                press.current = p;
              }}
              onPointerUp={() => press.current && clearTimeout(press.current.timer)}
              onContextMenu={(e) => e.preventDefault()}
              onClick={() => {
                const long = press.current?.long;
                press.current = null;
                if (long || locked) return;
                setWho(null);
                onToggle(c.emoji);
              }}
            >
              <span aria-hidden>{c.emoji}</span>
              <span aria-hidden className={cn('font-medium', !c.mine && 'text-pencil')}>
                {c.count}
              </span>
            </button>
            {who === c.emoji && (
              <span role="tooltip" className="absolute bottom-full left-0 z-10 mb-1 rounded-lg bg-ink px-2 py-1 text-xs whitespace-nowrap text-paper shadow-float">
                {c.names.join(', ')}
              </span>
            )}
          </span>
        );
      })}
      <AddReaction onPick={onToggle} />
    </div>
  );
}
