import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { openInvite } from '@/features/couple/actions';
import { getMyCouple } from '@/features/couple/couple';
import { CreateCoupleForm } from '@/features/couple/forms';

export default async function OnboardingPage() {
  if (await getMyCouple()) redirect('/library');
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 p-6">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold">Start a shared library</h1>
        <CreateCoupleForm />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Or join your partner</h2>
        <form action={openInvite} className="flex gap-2">
          <input className="w-full rounded-md border px-3 py-2" name="code" placeholder="Invite link or code" aria-label="Invite link or code" required />
          <Button type="submit" variant="outline">
            Open
          </Button>
        </form>
      </section>
    </main>
  );
}
