import { notFound, redirect } from 'next/navigation';
import { getMyCouple, getUserId } from '@/features/couple/couple';
import { chapterTitle } from '@/features/together/discussion';
import { Discussion } from '@/features/together/discussion-ui';
import { createUserClient } from '@/lib/supabase-server';

export default async function DiscussPage(props: { params: Promise<{ bookId: string; spine: string }> }) {
  const { bookId, spine: rawSpine } = await props.params;
  const [couple, userId] = await Promise.all([getMyCouple(), getUserId()]);
  if (!couple || !userId) redirect('/library');
  const me = couple.members.find((m) => m.userId === userId);
  if (!me) redirect('/library');

  const db = await createUserClient();
  const { data: book } = await db.from('book').select('title, spine_lengths').eq('id', bookId).maybeSingle();
  const spine = Number(rawSpine);
  if (!book || !Number.isInteger(spine) || spine < 0 || spine >= book.spine_lengths.length) notFound();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <header>
        <p className="text-sm text-gray-600">{book.title}</p>
        <h1 className="text-2xl font-bold">Discuss {chapterTitle(spine)}</h1>
      </header>
      <Discussion bookId={bookId} spine={spine} me={me} partner={couple.members.find((m) => m.userId !== userId) ?? null} />
    </main>
  );
}
