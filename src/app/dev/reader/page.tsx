import { notFound } from 'next/navigation';
import { DevReader } from './dev-reader';

export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <DevReader />;
}
