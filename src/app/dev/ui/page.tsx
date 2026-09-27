import { notFound } from 'next/navigation';
import { DevUi } from './dev-ui';

export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <DevUi />;
}
