import { notFound, redirect } from 'next/navigation';
import { getMyCouple, getUserId } from '@/features/couple/couple';
import { createUserClient } from '@/lib/supabase-server';
import { BookReader } from './book-reader';

const SIGNED_URL_SECONDS = 60;

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [couple, userId] = await Promise.all([getMyCouple(), getUserId()]);
  if (!couple || !userId) redirect('/onboarding');
  const db = await createUserClient();
  const { data: book } = await db.from('book').select('id, couple_id, title, storage_path, spine_lengths').eq('id', id).maybeSingle();
  if (!book?.storage_path || book.couple_id !== couple.id) notFound();
  const [signed, progress] = await Promise.all([
    db.storage.from('books').createSignedUrl(book.storage_path, SIGNED_URL_SECONDS),
    db.from('progress').select('user_id, pos, max_pos, locator').eq('book_id', id),
  ]);
  if (signed.error) throw signed.error;
  if (progress.error) throw progress.error;
  return (
    <BookReader
      bookId={book.id}
      title={book.title}
      userId={userId}
      fileUrl={signed.data.signedUrl}
      spineLengths={book.spine_lengths}
      mine={progress.data.find((p) => p.user_id === userId) ?? null}
    />
  );
}
