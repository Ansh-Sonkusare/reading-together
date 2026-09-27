import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ToastProps = { children: ReactNode; color?: string; action?: ReactNode; className?: string };

/**
 * Styling only: a floating pill pinned above the bottom edge, announced politely.
 * The caller owns when it shows and hides. `color` adds an ink dot for the partner it is about.
 */
export function Toast({ children, color, action, className }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-full bg-popover px-5 py-3 text-sm text-popover-foreground shadow-float',
        className,
      )}
    >
      {color && <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />}
      <span className="flex-1">{children}</span>
      {action}
    </div>
  );
}
