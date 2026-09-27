import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getMyCouple, getUserId } from '@/features/couple/couple';
import { chapterTitle } from '@/features/together/discussion';
import { Discussion } from '@/features/together/discussion-ui';
import type { Toc } from '@/features/reader';
import { createUserClient } from '@/lib/supabase-server';

const quietLink = 'rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-wash hover:text-foreground';

export default async function DiscussPage(props: { params: Promise<{ bookId: string; spine: string }> }) {
  const { bookId, spine: rawSpine } = await props.params;
  const [couple, userId] = await Promise.all([getMyCouple(), getUserId()]);
  if (!couple || !userId) redirect('/library');
  const me = couple.members.find((m) => m.userId === userId);
  if (!me) redirect('/library');

  const db = await createUserClient();
  const { data: book } = await db.from('book').select('title, spine_lengths, toc').eq('id', bookId).maybeSingle();
  const spine = Number(rawSpine);
  if (!book || !Number.isInteger(spine) || spine < 0 || spine >= book.spine_lengths.length) notFound();
  const chapter = chapterTitle(book.toc as Toc | null, spine);
  if (chapter === null) notFound();

  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-8 px-4 pt-4 pb-16 sm:px-8">
      <nav className="-mx-3 flex items-center gap-1" aria-label="Main">
        <Link href={`/book/${bookId}`} className={quietLink}>
          Back to the book
        </Link>
        <Link href={`/together/book/${bookId}`} className={quietLink}>
          Our story
        </Link>
      </nav>
      <header className="flex flex-col gap-2">
        <p className="font-serif text-muted-foreground italic">{book.title}</p>
        <h1 className="text-3xl">Discuss {chapter}</h1>
        <p className="text-muted-foreground">Answer first. You see each other&apos;s answers only once you&apos;ve both written yours.</p>
      </header>
      <Discussion bookId={bookId} spine={spine} me={me} partner={couple.members.find((m) => m.userId !== userId) ?? null} />
    </main>
  );
}
