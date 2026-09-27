import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listBooks } from '@/features/couple/books';
import { getMyCouple } from '@/features/couple/couple';
import { getCoupleStats } from '@/features/together/stats';

// P31 renders the reading streak here.
function StreakRow(): null {
  return null;
}

export default async function TogetherPage() {
  const couple = await getMyCouple();
  if (!couple) redirect('/onboarding');
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
      <StreakRow />
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
