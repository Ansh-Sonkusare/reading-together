import { redirect } from 'next/navigation';
import { FULL, INVALID, getMyCouple, inviteStatus } from '@/features/couple/couple';
import { JoinForm } from '@/features/couple/forms';

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const mine = await getMyCouple();
  if (mine?.inviteCode === code) redirect('/library');
  const status = await inviteStatus(code);
  const error = mine ? "You're already in a couple." : status === 'full' ? FULL : status === 'invalid' ? INVALID : null;
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Join your partner&apos;s library</h1>
      {error ? (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      ) : (
        <JoinForm code={code} />
      )}
    </main>
  );
}
