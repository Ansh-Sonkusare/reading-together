import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/types';

const env: Record<string, string> = JSON.parse(
  execSync('pnpm exec supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
);
const run = Date.now().toString(36);

test('Enable notifications stores a push subscription and the service worker shows a push', async ({ baseURL }) => {
  test.setTimeout(150_000);
  // Push needs a real profile: Chromium refuses push subscriptions in incognito contexts (browser.newContext),
  // and the headless shell reports every notification permission as denied.
  const profile = mkdtempSync(join(tmpdir(), 'push-profile-'));
  const context = await chromium.launchPersistentContext(profile, { channel: 'chromium', permissions: ['notifications'] });
  const page = await context.newPage();
  const email = `push-${run}@test.local`;
  const password = 'password-123';

  await page.goto(baseURL!);
  await page.getByRole('tab', { name: 'Sign up' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/onboarding');
  await page.getByLabel('Your name').fill('Alex');
  await page.locator('input[name=color]').first().check({ force: true });
  await page.getByRole('button', { name: 'Start our library' }).click();
  await page.waitForURL('**/library');

  expect(await page.evaluate(() => navigator.serviceWorker.getRegistration('/'))).toBeUndefined();
  await page.getByRole('button', { name: 'Enable notifications' }).click();
  // subscribe() registers with the browser's real push service (FCM), which takes ~30 s headless.
  await expect(page.getByTestId('notifications')).toHaveText('🔔 Notifications are on', { timeout: 90_000 });

  const db = createClient<Database>(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
  const signed = await db.auth.signInWithPassword({ email, password });
  expect(signed.error).toBeNull();
  const { data: subs, error } = await db.from('push_sub').select('user_id, endpoint, keys');
  expect(error).toBeNull();
  expect(subs).toHaveLength(1);
  expect(subs![0].user_id).toBe(signed.data.user!.id);
  const browserSub = await page.evaluate(async () => (await (await navigator.serviceWorker.ready).pushManager.getSubscription())?.toJSON());
  expect(subs![0]).toMatchObject({ endpoint: browserSub!.endpoint, keys: browserSub!.keys });

  await page.reload();
  await expect(page.getByTestId('notifications')).toHaveText('🔔 Notifications are on');

  // A real push service can't reach headless Chromium, so deliver the payload the sender builds straight to sw.js.
  const cdp = await context.newCDPSession(page);
  const registrationId = new Promise<string>((resolve) =>
    cdp.on('ServiceWorker.workerRegistrationUpdated', ({ registrations }) => {
      const reg = registrations.find((r: { scopeURL: string; isDeleted: boolean }) => r.scopeURL === `${baseURL}/` && !r.isDeleted);
      if (reg) resolve(reg.registrationId);
    }),
  );
  await cdp.send('ServiceWorker.enable');
  const note = { title: '📖 Bea finished Chapter 5', body: 'Come read it with me!', url: '/together' };
  await cdp.send('ServiceWorker.deliverPushMessage', { origin: baseURL!, registrationId: await registrationId, data: JSON.stringify(note) });
  await expect
    .poll(() =>
      page.evaluate(async () =>
        (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => ({ title: n.title, body: n.body, data: n.data })),
      ),
    )
    .toEqual([{ title: note.title, body: note.body, data: { url: '/together' } }]);

  await context.close();
  rmSync(profile, { recursive: true, force: true });
});
