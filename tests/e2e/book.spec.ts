import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { PASSWORD, myPage, myPos, pair, pairUp, turn, uploadAndOpen, waitForSave } from './helpers';

process.loadEnvFile('.env.local');

const SHOTS = '.verify/p13b-p15';

test('partners open a shared book; progress is saved, restored and shown live to the other', async ({ browser }) => {
  const { a, b, emailA } = await pairUp(browser);
  const bookPath = await uploadAndOpen(a);
  await expect(myPos(a)).toHaveText('0.125000');
  await expect(pair(a)).toHaveText("Sam hasn't started · you p.1");

  const nextA = a.getByRole('button', { name: 'Next page' });
  for (let i = 0; i < 3; i++) await turn(a, () => nextA.click());
  for (let i = 0; i < 2; i++) await turn(a, () => a.keyboard.press('ArrowRight'));
  const reached = await waitForSave(a);
  expect(Number(reached)).toBeGreaterThan(1);

  await a.reload();
  await expect(myPos(a)).toHaveText(reached);

  await b.goto(bookPath);
  await expect(myPos(b)).toHaveText('0.125000');
  const x = await myPage(a);
  await expect(pair(b)).toHaveText(`Alex p.${x} · you p.1`);

  for (let i = 0; i < 3; i++) await turn(a, () => nextA.click());
  await waitForSave(a);
  const x2 = await myPage(a);
  expect(x2).toBeGreaterThan(x);
  await expect(pair(b)).toHaveText(`Alex p.${x2} · you p.1`, { timeout: 3000 });
  await expect(pair(a)).toHaveText(`Sam p.1 · you p.${x2}`);
  await a.screenshot({ path: `${SHOTS}/a-alex-bar.png` });
  await b.screenshot({ path: `${SHOTS}/b-sam-bar.png` });

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data: auth } = await db.auth.signInWithPassword({ email: emailA, password: PASSWORD });
  const bookId = bookPath.split('/').pop()!;
  const read = async () => (await db.from('progress').select('pos, max_pos').eq('book_id', bookId).eq('user_id', auth.user!.id).single()).data!;
  const high = await read();
  expect(high.max_pos).toBeGreaterThan(high.pos);

  const prevA = a.getByRole('button', { name: 'Previous page' });
  await turn(a, () => prevA.click());
  await turn(a, () => a.keyboard.press('ArrowLeft'));
  const back = await waitForSave(a);
  await a.reload();
  await expect(myPos(a)).toHaveText(back);
  const after = await read();
  expect(after.pos.toFixed(6)).toBe(back);
  expect(after.pos).toBeLessThan(high.pos);
  expect(after.max_pos).toBe(high.max_pos);
});
