import { expect, test, type Page } from '@playwright/test';
import { pairUp, select, tap, thread, toChapter1, uploadAndOpen } from './helpers';

const SHOTS = '.verify/reactions';
const LIVE_MS = 3000;
const P1 = 'Alice was beginning to get very tired';

const onPage = (page: Page) => page.getByRole('list', { name: 'Reactions on this page' });
const chip = (scope: Page | ReturnType<typeof thread>, emoji: string, count: number) => scope.getByRole('button', { name: new RegExp(`^${emoji} ${count}:`) });

async function appDark(page: Page, dark: boolean) {
  await page.getByLabel('Reading settings').click();
  await page.getByLabel('App theme').selectOption(dark ? 'dark' : 'light');
  await page.getByLabel('Reading theme').selectOption(dark ? 'dark' : 'light');
  await page.getByLabel('Reading settings').click();
}

test('reactions are Discord-style chips: any emoji from the picker, counts, toggles, live for both', async ({ browser }) => {
  const { a, b } = await pairUp(browser, { viewport: { width: 390, height: 844 } });
  await a.setViewportSize({ width: 1280, height: 800 });
  const bookPath = await uploadAndOpen(a);
  await b.goto(bookPath);
  await toChapter1(a);
  await toChapter1(b);

  await (await select(a, P1)).getByRole('button', { name: 'Emotional' }).click();
  const menu = await select(a, P1);
  await menu.getByRole('button', { name: 'More reactions' }).click();
  await menu.getByLabel('Search emoji').fill('unicorn');
  await expect(menu.getByRole('gridcell', { name: 'Unicorn' })).toBeVisible();
  await a.screenshot({ path: `${SHOTS}/1-picker-desktop-light.png` });
  await menu.getByRole('gridcell', { name: 'Unicorn' }).click();
  await expect(menu).toBeHidden();

  await expect(onPage(a).getByRole('button', { name: '😭 1: You', exact: true })).toBeVisible();
  await expect(onPage(a).getByRole('button', { name: '🦄 1: You', exact: true })).toBeVisible();
  const bChips = onPage(b);
  await expect(bChips.getByRole('button', { name: '😭 1: Alex', exact: true })).toBeVisible({ timeout: LIVE_MS });
  await expect(bChips.getByRole('button', { name: '🦄 1: Alex', exact: true })).toHaveText('🦄1');
  await expect(bChips.getByRole('button', { name: '😭 1: Alex', exact: true })).toHaveAttribute('aria-pressed', 'false');

  await bChips.getByRole('button', { name: '😭 1: Alex', exact: true }).click();
  await expect(bChips.getByRole('button', { name: '😭 2: Alex, You', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(onPage(a).getByRole('button', { name: '😭 2: You, Sam', exact: true })).toBeVisible({ timeout: LIVE_MS });
  await onPage(a).getByRole('button', { name: '😭 2: You, Sam', exact: true }).hover();
  await expect(a.getByRole('tooltip')).toHaveText('You, Sam');
  await a.screenshot({ path: `${SHOTS}/2-on-page-desktop-light.png` });
  await b.screenshot({ path: `${SHOTS}/2-on-page-phone-light.png` });

  await tap(b, P1);
  await expect(chip(thread(b), '😭', 2)).toBeVisible();
  await expect(chip(thread(b), '🦄', 1)).toBeVisible();
  await b.screenshot({ path: `${SHOTS}/3-thread-phone-light.png` });
  await chip(thread(b), '😭', 2).click();
  await expect(chip(thread(b), '😭', 1)).toHaveAttribute('aria-pressed', 'false');
  await expect(onPage(a).getByRole('button', { name: '😭 1: You', exact: true })).toBeVisible({ timeout: LIVE_MS });

  await thread(b).getByRole('button', { name: 'Add reaction' }).click();
  const sheet = b.getByRole('dialog', { name: 'Add a reaction' });
  await expect(sheet.getByLabel('Search emoji')).toBeVisible();
  await expect(sheet.getByRole('gridcell', { name: 'Grinning face', exact: true })).toBeVisible();
  await b.screenshot({ path: `${SHOTS}/4-picker-phone-light.png` });
  await sheet.getByRole('gridcell', { name: 'Grinning face', exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(chip(thread(b), '😀', 1)).toHaveAttribute('aria-pressed', 'true');
  await expect(onPage(a).getByRole('button', { name: '😀 1: Sam', exact: true })).toBeVisible({ timeout: LIVE_MS });
  await thread(b).getByRole('button', { name: 'Close' }).click();

  await tap(a, P1);
  await expect(chip(thread(a), '🦄', 1)).toHaveAttribute('aria-pressed', 'true');
  await a.screenshot({ path: `${SHOTS}/3-thread-desktop-light.png` });
  await thread(a).getByRole('button', { name: 'Close' }).click();

  for (const page of [a, b]) await appDark(page, true);
  await a.screenshot({ path: `${SHOTS}/5-on-page-desktop-dark.png` });
  await b.screenshot({ path: `${SHOTS}/5-on-page-phone-dark.png` });
  await tap(b, P1);
  await expect(chip(thread(b), '😀', 1)).toBeVisible();
  await b.screenshot({ path: `${SHOTS}/6-thread-phone-dark.png` });
  await thread(b).getByRole('button', { name: 'Close' }).click();
  await onPage(a).getByRole('button', { name: 'Add reaction' }).first().click();
  await expect(a.getByRole('dialog', { name: 'Add a reaction' }).getByRole('gridcell', { name: 'Grinning face', exact: true })).toBeVisible();
  await a.screenshot({ path: `${SHOTS}/6-picker-desktop-dark.png` });
});
