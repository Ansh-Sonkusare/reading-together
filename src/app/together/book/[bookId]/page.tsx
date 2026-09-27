import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getMyCouple, getUserId } from '@/features/couple/couple';
import { getTimeline } from '@/features/together/timeline-data';
import { Timeline } from '@/features/together/timeline-view';

export default async function BookTimelinePage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  const [couple, meId] = await Promise.all([getMyCouple(), getUserId()]);
  if (!couple || !meId) redirect('/onboarding');
  const timeline = await getTimeline(bookId);
  if (!timeline) notFound();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Our Book: {timeline.title}</h1>
        <Link href="/together" className="text-sm underline">
          Our Reading
        </Link>
      </header>
      <Timeline events={timeline.events} members={couple.members} meId={meId} title={timeline.title} toc={timeline.toc} />
    </main>
  );
}
