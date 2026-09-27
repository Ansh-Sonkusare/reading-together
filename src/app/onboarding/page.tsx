import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { openInvite } from '@/features/couple/actions';
import { getMyCouple } from '@/features/couple/couple';
import { CreateCoupleForm } from '@/features/couple/forms';

export default async function OnboardingPage() {
  if (await getMyCouple()) redirect('/library');
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-10 px-4 py-10">
      <section className="flex flex-col gap-5 rounded-sheet border bg-card p-6 [&_input:not([type=radio])]:rounded-xl [&_input:not([type=radio])]:bg-background">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl">Start a shared library</h1>
          <p className="text-muted-foreground">Pick your name and your ink. Everything you leave in the margins shows in it.</p>
        </div>
        <CreateCoupleForm />
      </section>
      <section className="flex flex-col gap-3 px-1">
        <h2 className="text-xl">Or join your partner</h2>
        <form action={openInvite} className="flex gap-2">
          <input
            className="h-10 w-full min-w-0 rounded-full border bg-card px-4"
            name="code"
            placeholder="Invite link or code"
            aria-label="Invite link or code"
            required
          />
          <Button type="submit" variant="outline" size="md">
            Open
          </Button>
        </form>
      </section>
    </main>
  );
}
