import { expect, test, type Page } from '@playwright/test';
import { myPos, pairUp, turn, uploadAndOpen } from './helpers';

const SHOTS = '.verify/p51';
const LIVE_MS = 2000;

const pill = (page: Page) => page.getByTestId('sync-pill');

test('sync mode: the follower tracks the leader live and leaves on its own turn', async ({ browser }) => {
  const { a, b } = await pairUp(browser);
  const bookPath = await uploadAndOpen(a);
  await b.goto(bookPath);
  await expect(myPos(b)).toHaveText('0.125000');

  await expect(pill(a)).toHaveText('Sam is hereRead together now');
  await expect(pill(b)).toHaveText('Alex is hereRead together now');
  await a.screenshot({ path: `${SHOTS}/1-a-sam-is-here.png` });

  await pill(a).getByRole('button', { name: 'Read together now' }).click();
  await expect(pill(a)).toHaveText('Waiting for Sam…Cancel');
  const invite = b.getByRole('dialog', { name: 'Read together' });
  await expect(invite).toContainText("Alex wants to read together. You'll follow Alex's pages.");
  await b.screenshot({ path: `${SHOTS}/2-b-invited.png` });
  await invite.getByRole('button', { name: 'Accept' }).click();
  await expect(invite).toBeHidden();
  await expect(pill(a)).toHaveText('Reading together with Sam ❤️Leave');
  await expect(pill(b)).toHaveText('Reading together with Alex ❤️Leave');

  const nextA = a.getByRole('button', { name: 'Next page' });
  for (let i = 0; i < 3; i++) {
    await turn(a, () => nextA.click());
    await expect(myPos(b)).toHaveText((await myPos(a).textContent())!, { timeout: LIVE_MS });
  }
  expect(Number(await myPos(b).textContent())).toBeGreaterThan(0.125);
  await a.screenshot({ path: `${SHOTS}/3-a-leading.png` });
  await b.screenshot({ path: `${SHOTS}/3-b-following.png` });

  const leaderPos = (await myPos(a).textContent())!;
  await turn(b, () => b.getByRole('button', { name: 'Next page' }).click());
  await expect(pill(b)).toHaveText('Alex is hereRead together nowYou left reading together.');
  await expect(pill(a)).toHaveText('Sam is hereRead together nowSam left reading together.', { timeout: LIVE_MS });
  await expect(myPos(a)).toHaveText(leaderPos);
  await a.screenshot({ path: `${SHOTS}/4-a-sam-left.png` });

  const ownPos = (await myPos(b).textContent())!;
  for (let i = 0; i < 2; i++) await turn(a, () => nextA.click());
  await a.waitForTimeout(LIVE_MS);
  await expect(myPos(b)).toHaveText(ownPos);

  await a.close();
  await expect(pill(b)).toHaveAttribute('data-state', 'solo', { timeout: 10_000 });
  await expect(pill(b)).toHaveText('');
  await b.screenshot({ path: `${SHOTS}/5-b-solo.png` });
});
