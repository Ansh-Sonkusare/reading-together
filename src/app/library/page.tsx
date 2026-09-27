import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { signOut } from '@/features/couple/actions';
import { listBooks } from '@/features/couple/books';
import { getMyCouple } from '@/features/couple/couple';
import { CopyInvite, UploadForm } from '@/features/couple/forms';

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default async function LibraryPage() {
  const couple = await getMyCouple();
  if (!couple) redirect('/onboarding');
  const books = await listBooks(couple.id, couple.members);
  const h = await headers();
  const inviteUrl = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}/join/${couple.inviteCode}`;
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Our library</h1>
        <form action={signOut}>
          <Button type="submit" variant="ghost">
            Sign out
          </Button>
        </form>
      </header>
      <ul className="flex gap-3" aria-label="Readers">
        {couple.members.map((m) => (
          <li key={m.userId} className="flex items-center gap-2">
            <span className="size-3 rounded-full" style={{ background: m.color }} />
            {m.name}
          </li>
        ))}
      </ul>
      {couple.members.length < 2 && (
        <section className="flex flex-col gap-2 rounded-lg border p-4">
          <h2 className="font-semibold">Invite your partner</h2>
          <CopyInvite url={inviteUrl} />
        </section>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Add a book</h2>
        <UploadForm />
      </section>
      {books.length === 0 ? (
        <p className="text-gray-600">No books yet. Upload an EPUB you both want to read.</p>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b">
              <th className="py-2">Title</th>
              <th>Author</th>
              <th>Added by</th>
              <th>Added</th>
            </tr>
          </thead>
          <tbody>
            {books.map((b) => (
              <tr key={b.id} className="border-b">
                <td className="py-2">
                  <Link href={`/book/${b.id}`} className="underline">
                    {b.title}
                  </Link>
                </td>
                <td>{b.author}</td>
                <td>{b.addedBy}</td>
                <td>{dateFormat.format(new Date(b.createdAt))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
