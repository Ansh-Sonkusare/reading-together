import { redirect } from 'next/navigation';
import { getUserId } from '@/features/couple/couple';
import { AuthForm } from '@/features/couple/forms';

const ribbon = 'absolute top-0 h-4 w-2.5 [clip-path:polygon(0_0,100%_0,100%_100%,50%_72%,0_100%)]';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = '/' } = await searchParams;
  if (await getUserId()) redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/');
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col gap-10">
        <div className="flex flex-col gap-4">
          <div aria-hidden className="relative h-4 w-24">
            <span className="absolute inset-x-0 top-0 h-0.5 rounded-full bg-rule" />
            <span className={`${ribbon} left-7 bg-[#d6336c]`} />
            <span className={`${ribbon} left-14 bg-[#3b5bdb]`} />
          </div>
          <h1 className="text-4xl">Reading Together</h1>
          <p className="text-lg text-muted-foreground">One book, two readers, and the notes you leave each other in the margins.</p>
        </div>
        <AuthForm next={next} />
      </div>
    </main>
  );
}
