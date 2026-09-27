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
    <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-8 px-4 pt-4 pb-16 sm:px-8">
      <nav className="-mx-3 flex items-center gap-1" aria-label="Main">
        <Link href="/together" className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-wash hover:text-foreground">
          Our reading
        </Link>
        <Link href={`/book/${bookId}`} className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-wash hover:text-foreground">
          Open the book
        </Link>
      </nav>
      <header className="flex flex-col gap-1">
        <p className="text-muted-foreground">Our story with</p>
        <h1 className="text-3xl sm:text-4xl">{timeline.title}</h1>
      </header>
      <Timeline events={timeline.events} members={couple.members} meId={meId} title={timeline.title} toc={timeline.toc} />
    </main>
  );
}
