import { test as setup } from '@playwright/test';
import { pairUp, uploadAndOpen } from './helpers';

// `next dev` compiles a route on its first request. With every worker opening cold routes at once on a loaded
// machine, a page could stay unhydrated past the test timeout (a file set on the library form never reached
// React, so Upload never appeared). One pass over every route compiles them before any spec starts.
setup('compile every route once', async ({ browser }) => {
  setup.setTimeout(180_000);
  const { a } = await pairUp(browser);
  const bookPath = await uploadAndOpen(a);
  const bookId = bookPath.split('/').at(-1)!;
  for (const path of ['/together', `/together/book/${bookId}`, `/discuss/${bookId}/1`, '/dev/ui']) await a.goto(path);
});
