import { redirect } from 'next/navigation';
import { FULL, INVALID, getMyCouple, inviteStatus } from '@/features/couple/couple';
import { JoinForm } from '@/features/couple/forms';
import { createAdminClient } from '@/lib/supabase-server';

// The joiner isn't a member yet, so RLS hides the partner; peek with the admin client to leave their ink out of the picker.
async function partnerColors(code: string): Promise<string[]> {
  const { data } = await createAdminClient().from('couple').select('member(color)').eq('invite_code', code).maybeSingle();
  return data?.member.flatMap((m) => m.color ?? []) ?? [];
}

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const mine = await getMyCouple();
  if (mine?.inviteCode === code) redirect('/library');
  const status = await inviteStatus(code);
  const error = mine ? "You're already in a couple." : status === 'full' ? FULL : status === 'invalid' ? INVALID : null;
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <section className="flex flex-col gap-5 rounded-sheet border bg-card p-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl">Join your partner&apos;s library</h1>
          {!error && <p className="text-muted-foreground">Pick your name and your ink. Your partner&apos;s ink is already taken.</p>}
        </div>
        {error ? (
          <p role="alert" className="text-danger">
            {error}
          </p>
        ) : (
          <JoinForm code={code} partnerColors={await partnerColors(code)} />
        )}
      </section>
    </main>
  );
}
