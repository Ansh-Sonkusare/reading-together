import { notFound, redirect } from 'next/navigation';
import { getMyCouple, getUserId } from '@/features/couple/couple';
import { createUserClient } from '@/lib/supabase-server';
import type { Locator } from '@/features/reader';
import { BookReader } from './book-reader';

const SIGNED_URL_SECONDS = 60;

export default async function BookPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mark?: string }> }) {
  const [{ id }, { mark }] = await Promise.all([params, searchParams]);
  const [couple, userId] = await Promise.all([getMyCouple(), getUserId()]);
  if (!couple || !userId) redirect('/onboarding');
  const db = await createUserClient();
  const { data: book } = await db.from('book').select('id, couple_id, title, storage_path, spine_lengths').eq('id', id).maybeSingle();
  if (!book?.storage_path || book.couple_id !== couple.id) notFound();
  const [signed, progress, target] = await Promise.all([
    db.storage.from('books').createSignedUrl(book.storage_path, SIGNED_URL_SECONDS),
    db.from('progress').select('user_id, pos, max_pos, locator').eq('book_id', id),
    mark ? db.from('mark').select('locator').eq('id', mark).eq('book_id', id).maybeSingle() : null,
  ]);
  if (signed.error) throw signed.error;
  if (progress.error) throw progress.error;
  const partner = couple.members.find((m) => m.userId !== userId);
  return (
    <BookReader
      bookId={book.id}
      title={book.title}
      userId={userId}
      fileUrl={signed.data.signedUrl}
      spineLengths={book.spine_lengths}
      mine={progress.data.find((p) => p.user_id === userId) ?? null}
      me={couple.members.find((m) => m.userId === userId)!}
      partner={partner ?? null}
      partnerProgress={progress.data.find((p) => p.user_id === partner?.userId) ?? null}
      startAt={(target?.data?.locator as Locator | null | undefined) ?? null}
    />
  );
}
