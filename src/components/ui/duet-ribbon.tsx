'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { layoutLabels, ribbonLabel, ribbonX, type RibbonMark } from './duet-ribbon-layout';

export type { RibbonMark };
export type DuetRibbonProps = { total: number; marks: RibbonMark[]; size?: 'sm' | 'md'; className?: string };

const SIZES = {
  sm: { ribbon: 'h-2.5 w-1.5', rw: 6, text: 'text-xs', row: 16, top: 14 },
  md: { ribbon: 'h-4 w-2.5', rw: 10, text: 'text-sm', row: 20, top: 22 },
};

/** The book as a spine line with each partner's bookmark ribbon hanging at pos/total, labelled underneath. */
export function DuetRibbon({ total, marks, size = 'md', className }: DuetRibbonProps) {
  const s = SIZES[size];
  const track = useRef<HTMLDivElement>(null);
  const labels = useRef<(HTMLSpanElement | null)[]>([]);
  const [placed, setPlaced] = useState<{ ribbons: number[]; labels: { left: number; row: number }[] } | null>(null);
  const xs = marks.map((m) => ribbonX(m.pos, total));
  const key = xs.join() + marks.map(ribbonLabel).join();

  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    // Ribbons on the same page sit side by side: the same no-overlap layout at ribbon width.
    const place = () =>
      setPlaced({
        ribbons: layoutLabels(xs.map((x) => ({ x, w: s.rw })), el.clientWidth, 1).map((r) => r.left),
        labels: layoutLabels(xs.map((x, i) => ({ x, w: labels.current[i]?.offsetWidth ?? 0 })), el.clientWidth),
      });
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    labels.current.forEach((l) => l && ro.observe(l));
    return () => ro.disconnect();
  }, [key, s.rw]);

  const rows = placed ? Math.max(1, ...placed.labels.map((p) => p.row + 1)) : 1;
  return (
    <div
      ref={track}
      role="img"
      aria-label={marks.map(ribbonLabel).join(', ')}
      className={cn('relative w-full', className)}
      style={{ height: s.top + rows * s.row }}
    >
      <div className="absolute inset-x-0 top-0 h-0.5 rounded-full bg-rule" />
      {marks.map((m, i) => (
        <span
          key={`r${i}`}
          className={cn('absolute top-0 [clip-path:polygon(0_0,100%_0,100%_100%,50%_72%,0_100%)]', s.ribbon)}
          style={{
            background: m.color,
            ...(placed?.ribbons[i] != null ? { left: placed.ribbons[i] } : { left: `${xs[i] * 100}%`, transform: 'translateX(-50%)' }),
          }}
        />
      ))}
      {marks.map((m, i) => (
        <span
          key={`l${i}`}
          ref={(el) => {
            labels.current[i] = el;
          }}
          aria-hidden
          className={cn('absolute whitespace-nowrap leading-none text-muted-foreground', s.text, m.isMe || 'font-medium text-foreground')}
          style={
            placed?.labels[i]
              ? { left: placed.labels[i].left, top: s.top + placed.labels[i].row * s.row }
              : { left: `${xs[i] * 100}%`, top: s.top, transform: 'translateX(-50%)' }
          }
        >
          {ribbonLabel(m)}
        </span>
      ))}
    </div>
  );
}
