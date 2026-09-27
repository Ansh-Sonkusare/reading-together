import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { DuetRibbon } from '@/components/ui/duet-ribbon';
import { signOut } from '@/features/couple/actions';
import { lastRead, listBooks, ribbonOf, type Book } from '@/features/couple/books';
import { getMyCouple, getUserId, type Member } from '@/features/couple/couple';
import { BookCover } from '@/features/couple/cover';
import { CopyInvite, UploadForm } from '@/features/couple/forms';
import { Inbox } from '@/features/couple/inbox';
import { EnableNotifications } from '@/features/notify/enable';
import { getStreakRow } from '@/features/together/streak-data';

const quietLink = 'rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-wash hover:text-foreground';

export default async function LibraryPage() {
  const [couple, userId] = await Promise.all([getMyCouple(), getUserId()]);
  if (!couple || !userId) redirect('/onboarding');
  const me = couple.members.find((m) => m.userId === userId)!;
  const partner = couple.members.find((m) => m.userId !== userId);
  const [books, streak] = await Promise.all([listBooks(couple.id), partner ? getStreakRow(couple, userId) : null]);
  const current = lastRead(books, userId);
  const h = await headers();
  const inviteUrl = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}/join/${couple.inviteCode}`;
  const readers = [me, ...(partner ? [partner] : [])];

  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-1 flex-col gap-10 px-4 pt-4 pb-16 sm:px-8">
      <nav className="-mx-3 flex items-center justify-end gap-1" aria-label="Main">
        <Link href="/together" className={quietLink}>
          Our reading
        </Link>
        <form action={signOut}>
          <button type="submit" className={quietLink}>
            Sign out
          </button>
        </form>
      </nav>

      <header className="flex flex-col gap-5 border-b pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl sm:text-4xl">
            <Names readers={readers} />
          </h1>
          {streak && <p className="text-muted-foreground">{streak.streak}</p>}
        </div>
        <UploadForm className="sm:items-end" />
      </header>

      {!partner && (
        <section className="flex flex-col gap-3 rounded-sheet bg-wash p-5 sm:p-6">
          <h2 className="text-xl">Invite your partner</h2>
          <p className="text-muted-foreground">Send them this link. Once they join, you&apos;ll see each other&apos;s place in every book.</p>
          <div className="max-w-xl">
            <CopyInvite url={inviteUrl} />
          </div>
        </section>
      )}

      {current && <ContinueReading book={current} members={couple.members} meId={userId} />}

      {partner && <Inbox meId={userId} partner={partner} books={books.map(({ id, title }) => ({ id, title }))} />}

      <section aria-labelledby="shelf" className="flex flex-col gap-5">
        <h2 id="shelf" className="text-xl">
          Our shelf
        </h2>
        {books.length === 0 ? (
          <div className="flex flex-col items-start gap-1 rounded-sheet border border-dashed p-6 sm:items-center sm:p-10 sm:text-center">
            <p className="font-serif text-xl">Nothing on the shelf yet</p>
            <p className="text-muted-foreground">Add an EPUB you both want to read. On a computer you can drop it anywhere on this page.</p>
          </div>
        ) : (
          <ul aria-label="Our shelf" className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4 sm:gap-x-6 lg:grid-cols-5">
            {books.map((b) => (
              <ShelfBook key={b.id} book={b} members={couple.members} meId={userId} />
            ))}
          </ul>
        )}
      </section>

      <EnableNotifications />
    </main>
  );
}

function Names({ readers }: { readers: Member[] }) {
  return readers.map((r, i) => (
    <span key={r.userId}>
      {i > 0 && <span className="text-pencil"> &amp; </span>}
      <span style={{ color: r.color }}>{r.name}</span>
    </span>
  ));
}

function ContinueReading({ book, members, meId }: { book: Book; members: Member[]; meId: string }) {
  const ribbon = ribbonOf(book, members, meId);
  return (
    <section aria-label="Continue reading" className="grid grid-cols-[88px_1fr] items-start gap-5 sm:grid-cols-[132px_1fr] sm:items-center sm:gap-8">
      <BookCover title={book.title} url={book.coverUrl} />
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl sm:text-3xl">{book.title}</h2>
          {book.author && <p className="text-muted-foreground">{book.author}</p>}
        </div>
        <DuetRibbon total={ribbon.total} marks={ribbon.marks} className="max-w-xl" />
        <Link href={`/book/${book.id}`} className={buttonVariants({ size: 'md', className: 'self-start' })}>
          Keep reading
        </Link>
      </div>
    </section>
  );
}

function ShelfBook({ book, members, meId }: { book: Book; members: Member[]; meId: string }) {
  const ribbon = ribbonOf(book, members, meId);
  return (
    <li className="flex min-w-0 flex-col gap-2">
      <Link href={`/book/${book.id}`} className="group flex flex-col gap-2.5 rounded-cover">
        <BookCover title={book.title} url={book.coverUrl} className="transition-transform duration-200 group-hover:-translate-y-1" />
        <span className="line-clamp-2 font-serif leading-snug font-semibold">{book.title}</span>
      </Link>
      {book.author && <p className="-mt-1 truncate text-sm text-muted-foreground">{book.author}</p>}
      {ribbon.marks.length > 0 && <DuetRibbon size="sm" total={ribbon.total} marks={ribbon.marks} className="mt-1" />}
    </li>
  );
}
