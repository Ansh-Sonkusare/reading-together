import { redirect } from 'next/navigation';
import { getUserId } from '@/features/couple/couple';
import { AuthForm } from '@/features/couple/forms';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = '/' } = await searchParams;
  if (await getUserId()) redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/');
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-bold">Reading Together</h1>
      <AuthForm next={next} />
    </main>
  );
}
