import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DuetRibbon } from '@/components/ui/duet-ribbon';
import { listBooks, ribbonOf } from '@/features/couple/books';
import { getMyCouple, getUserId } from '@/features/couple/couple';
import { BookCover } from '@/features/couple/cover';
import { GoalForm, TimezoneSync } from '@/features/together/goal-form';
import { statsSentence } from '@/features/together/sentence';
import { getCoupleStats } from '@/features/together/stats';
import { getStreakRow } from '@/features/together/streak-data';

export default async function TogetherPage() {
  const [couple, me] = await Promise.all([getMyCouple(), getUserId()]);
  if (!couple || !me) redirect('/onboarding');
  const [stats, books, row] = await Promise.all([getCoupleStats(couple.id), listBooks(couple.id), getStreakRow(couple, me)]);
  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-10 px-4 pt-4 pb-16 sm:px-8">
      <nav className="-mx-3" aria-label="Main">
        <Link href="/library" className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-wash hover:text-foreground">
          Library
        </Link>
      </nav>

      <header className="flex flex-col gap-3">
        <h1 className="text-3xl sm:text-4xl">Our reading</h1>
        <p className="font-serif text-xl leading-relaxed text-pretty">{statsSentence(stats)}</p>
      </header>

      <section aria-label="Streak" className="flex flex-col gap-3 border-y py-6">
        <TimezoneSync current={row.timezone} />
        <p className="text-xl font-medium" data-testid="streak">
          {row.streak}
        </p>
        {row.goalProgress && (
          <p className="text-muted-foreground" data-testid="goal-progress">
            {row.goalProgress}
          </p>
        )}
        <details className="group">
          <summary className="w-fit cursor-pointer list-none rounded-full text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline [&::-webkit-details-marker]:hidden">
            {row.goal ? 'Change the daily goal' : 'Set a daily goal'}
          </summary>
          <div className="pt-4">
            <GoalForm goal={row.goal} />
          </div>
        </details>
      </section>

      {stats.favoriteReactions.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="reactions">
          <h2 id="reactions" className="text-xl">
            Favourite reactions
          </h2>
          <ul className="flex flex-wrap gap-2">
            {stats.favoriteReactions.map((r) => (
              <li key={r.key} className="flex items-center gap-1.5 rounded-full bg-wash px-3.5 py-1.5 text-sm">
                <span aria-hidden>{r.emoji}</span>
                {r.label}
                <span className="font-semibold tabular-nums">{r.count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-4" aria-labelledby="books">
        <h2 id="books" className="text-xl">
          Our books
        </h2>
        {books.length === 0 ? (
          <p className="text-muted-foreground">
            No books yet.{' '}
            <Link href="/library" className="text-foreground underline underline-offset-4">
              Add one to your shelf
            </Link>{' '}
            and start reading together.
          </p>
        ) : (
          <ul className="flex flex-col">
            {books.map((b) => {
              const ribbon = ribbonOf(b, couple.members, me);
              return (
                <li key={b.id} className="grid grid-cols-[44px_1fr] items-start gap-4 border-b py-4 last:border-b-0">
                  <BookCover title={b.title} url={b.coverUrl} />
                  <div className="flex min-w-0 flex-col gap-2">
                    <div>
                      <Link href={`/together/book/${b.id}`} className="font-serif font-semibold underline-offset-4 hover:underline">
                        {b.title}
                      </Link>
                      {b.author && <p className="text-sm text-muted-foreground">{b.author}</p>}
                    </div>
                    {ribbon.marks.length > 0 ? (
                      <DuetRibbon size="sm" total={ribbon.total} marks={ribbon.marks} />
                    ) : (
                      <p className="text-sm text-muted-foreground">Not started yet</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
