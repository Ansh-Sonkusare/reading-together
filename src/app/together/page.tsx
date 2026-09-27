import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listBooks } from '@/features/couple/books';
import { getMyCouple, getUserId, type Couple } from '@/features/couple/couple';
import { EnableNotifications } from '@/features/notify/enable';
import { GoalForm, TimezoneSync } from '@/features/together/goal-form';
import { getCoupleStats } from '@/features/together/stats';
import { getStreakRow } from '@/features/together/streak-data';

async function StreakRow({ couple, me }: { couple: Couple; me: string }) {
  const row = await getStreakRow(couple, me);
  return (
    <section className="flex flex-col gap-2 rounded-lg border p-4" aria-label="Streak">
      <TimezoneSync current={row.timezone} />
      <p className="text-lg font-semibold" data-testid="streak">
        {row.streak}
      </p>
      {row.goalProgress && <p data-testid="goal-progress">{row.goalProgress}</p>}
      <GoalForm goal={row.goal} />
    </section>
  );
}

export default async function TogetherPage() {
  const [couple, me] = await Promise.all([getMyCouple(), getUserId()]);
  if (!couple || !me) redirect('/onboarding');
  const [stats, books] = await Promise.all([getCoupleStats(couple.id), listBooks(couple.id, couple.members)]);
  const tiles = [
    ['📚', stats.booksTogether, stats.booksTogether === 1 ? 'book together' : 'books together'],
    ['📖', stats.pages, stats.pages === 1 ? 'page' : 'pages'],
    ['❤️', stats.highlights, stats.highlights === 1 ? 'highlight' : 'highlights'],
    ['💬', stats.discussions, stats.discussions === 1 ? 'discussion' : 'discussions'],
  ] as const;
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Our Reading</h1>
        <Link href="/library" className="text-sm underline">
          Library
        </Link>
      </header>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Stats">
        {tiles.map(([emoji, n, label]) => (
          <li key={label} className="flex flex-col items-center rounded-lg border p-4 text-center">
            <span className="text-2xl" aria-hidden>
              {emoji}
            </span>
            <span className="text-2xl font-bold">{n.toLocaleString('en-US')}</span>
            <span className="text-sm text-gray-600">{label}</span>
          </li>
        ))}
      </ul>
      <StreakRow couple={couple} me={me} />
      <EnableNotifications />
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Favorite reactions</h2>
        {stats.favoriteReactions.length === 0 ? (
          <p className="text-gray-600">No reactions yet.</p>
        ) : (
          <ol className="flex flex-col gap-1">
            {stats.favoriteReactions.map((r) => (
              <li key={r.key} className="flex items-center gap-2">
                <span aria-hidden>{r.emoji}</span>
                <span className="flex-1">{r.label}</span>
                <span className="font-semibold">{r.count}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Our books</h2>
        {books.length === 0 ? (
          <p className="text-gray-600">No books yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {books.map((b) => (
              <li key={b.id}>
                <Link href={`/together/book/${b.id}`} className="underline">
                  {b.title}
                </Link>
                {b.author && <span className="text-gray-600"> · {b.author}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
