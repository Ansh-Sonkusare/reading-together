'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { useInbox } from '@/features/marks/data';
import { cn } from '@/lib/utils';
import type { Member } from './couple';

/** "From {partner}": passages they sent, as quote cards in their ink. Live while mounted. */
export function Inbox({ meId, partner, books }: { meId: string; partner: Member; books: { id: string; title: string }[] }) {
  const sends = useInbox(meId);
  return (
    <section aria-label={`From ${partner.name}`} className="flex flex-col gap-3">
      <h2 className="text-xl">From {partner.name}</h2>
      {sends.length === 0 ? (
        <p className="text-muted-foreground">When {partner.name} sends you a passage, it lands here.</p>
      ) : (
        <ul className="grid items-start gap-3 md:grid-cols-2">
          {sends.map((m) => (
            <li
              key={m.id}
              className="relative flex flex-col gap-3 overflow-hidden rounded-sheet border bg-leaf p-5 pl-6"
              style={{ '--partner': partner.color } as CSSProperties}
            >
              <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[var(--partner)]" />
              <blockquote
                className={cn(
                  'text-lg leading-relaxed',
                  !/^["“‘']/.test(m.locator?.quote?.exact ?? '') && "before:mr-0.5 before:font-semibold before:text-[var(--partner)] before:content-['“'] after:content-['”']",
                )}
              >
                {m.locator?.quote?.exact}
              </blockquote>
              {m.body && <p>{m.body}</p>}
              <Link href={`/book/${m.book_id}?mark=${m.id}`} className="self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                Open in {books.find((b) => b.id === m.book_id)?.title ?? 'the book'}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
