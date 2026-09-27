import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { signOut } from '@/features/couple/actions';
import { getMyCouple } from '@/features/couple/couple';
import { CopyInvite } from '@/features/couple/forms';

export default async function LibraryPage() {
  const couple = await getMyCouple();
  if (!couple) redirect('/onboarding');
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
    </main>
  );
}
