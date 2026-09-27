import { cn } from '@/lib/utils';

/** The book's own cover, or a typographic one: title in Literata on a Wash panel with a thin ink rule. Decorative; the title is always said next to it. */
export function BookCover({ title, url, className }: { title: string; url: string | null; className?: string }) {
  return (
    <div aria-hidden className={cn('@container relative aspect-[2/3] w-full overflow-hidden rounded-cover bg-wash ring-1 ring-rule', className)}>
      {url ? (
        <img src={url} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <div className="flex size-full flex-col justify-between p-[9%]">
          <span className="line-clamp-5 font-serif text-[clamp(0.8rem,11cqi,1.25rem)] leading-snug font-semibold text-balance text-ink">{title}</span>
          <span className="h-px w-2/5 bg-ink/60" />
        </div>
      )}
    </div>
  );
}
