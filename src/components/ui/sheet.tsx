'use client';

import { Dialog } from '@base-ui/react/dialog';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

/** Bottom sheet on phones, side panel from 768px. Modal: focus is trapped and Escape closes it. */
export function Sheet({ open, onOpenChange, title, description, children, className }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-[rgb(38_36_58/0.3)] transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          className={cn(
            'fixed inset-x-0 bottom-0 z-40 flex max-h-[85dvh] flex-col gap-3 overflow-y-auto rounded-t-sheet bg-popover p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-popover-foreground shadow-float outline-none transition-transform duration-200',
            'data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full',
            'md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[400px] md:rounded-l-sheet md:rounded-tr-none',
            'md:data-[ending-style]:translate-x-full md:data-[ending-style]:translate-y-0 md:data-[starting-style]:translate-x-full md:data-[starting-style]:translate-y-0',
            className,
          )}
        >
          <div aria-hidden className="mx-auto h-1 w-10 shrink-0 rounded-full bg-rule md:hidden" />
          <Dialog.Title className="font-serif text-xl font-semibold">{title}</Dialog.Title>
          {description && <Dialog.Description className="text-sm text-muted-foreground">{description}</Dialog.Description>}
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
