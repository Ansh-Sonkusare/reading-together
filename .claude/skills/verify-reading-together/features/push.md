# Web push (P33)

**Status: built.** `EnableNotifications` (`src/features/notify/enable.tsx`)
on `/together`, `public/sw.js`, and a `push_sub` table + edge function that
turns partner events into personal push notifications
(`src/features/notify/wording.ts` decides the wording; see
`notificationFor`'s cases for the full per-event-type text). Selectors and
the flow below are copied from `tests/e2e/push.spec.ts`, which already
drives this markup — **and that spec is the actual way to run this
recipe**, for reasons below.

## This one can't be driven through drive.mjs's shared browser

Every other feature file drives two partners as two `BrowserContext`s in
one shared `chromium.launch()` instance (`partner()`/`twoPartners()`).
Push can't work that way:

- **Real push subscriptions need a real (non-incognito) profile.**
  Chromium refuses `pushManager.subscribe()` in an ordinary
  `browser.newContext()`; it needs `chromium.launchPersistentContext(profile,
  { channel: 'chromium', permissions: ['notifications'] })` — a second,
  separate browser instance with its own on-disk profile, not another
  context on the shared one.
- **Subscribing hits the real push service (FCM) over the network** and
  takes up to ~90s headless — budget for that; it isn't a local-only
  check.
- **Device delivery cannot be verified locally at all.** This proves the
  subscription is stored correctly and that a payload the sender's wording
  produces displays correctly through the service worker. It does not and
  cannot prove a notification reaches a real phone/browser off this
  machine — that leg is FCM/APNs infrastructure outside this app.

So: run `pnpm exec playwright test tests/e2e/push.spec.ts` directly (with
the dev server from `scripts/launch.sh` as its `baseURL`) rather than
scripting this one through `drive.mjs`. If a bespoke script is needed,
copy the persistent-context setup from `push.spec.ts` verbatim rather than
trying to fit it into `partner()`.

## Sub-features

- `enable-toggle` — `/together`'s "Enable notifications" button requests
  permission only on click (never on page load), registers `/sw.js`,
  subscribes via `PushManager`, and stores the subscription in `push_sub`.
- `state-persists` — after enabling, a reload shows "🔔 Notifications are
  on" immediately (no re-subscribe).
- `wording-per-event` — `notificationFor()` produces the exact
  title/body/url for each event type reaching a recipient (chapter
  finished, book finished, a reaction/reply/note/highlight/send/memory on
  something the recipient can see, an answer reveal) — see
  `src/features/notify/wording.ts` for the literal strings; this file
  doesn't re-list all of them.
- `click-opens-url` — `sw.js`'s `notificationclick` focuses an already-open
  tab at that URL or opens a new one.

## How to get to it (user POV)

- `/together` → "Enable notifications" button (inside `aria-label="Notifications"`).
- A partner's action elsewhere in the app (react, reply, finish a
  chapter, …) is what triggers the actual push later — this file only
  covers the subscribe/deliver mechanics, not every trigger (those are
  each already covered by their own feature file plus `wording.ts`'s unit
  tests).

## Driving it (via the real e2e spec, not drive.mjs)

Preconditions:

- `scripts/launch.sh` is running and `scripts/doctor.sh` passes (same dev
  server `push.spec.ts` targets via `baseURL`).
- Run from the repo root: `pnpm exec playwright test tests/e2e/push.spec.ts
  --headed=false` (matches how the suite already runs it; the spec reads
  `pnpm exec supabase status -o json` itself, no env setup needed beyond
  the running local stack).

- **Sign up and enable.** The spec signs up fresh, lands on `/library`,
  confirms no service worker is registered yet, clicks "Enable
  notifications", and waits (up to 90s) for `data-testid="notifications"`
  to read "🔔 Notifications are on".
- **The subscription is real.** It signs in with the service-role client
  and reads `push_sub` back by `user_id`; the stored `endpoint`/`keys`
  match what `pushManager.getSubscription()` reports browser-side —
  proving the row isn't just locally cached state.
- **Reload keeps it on.** A reload shows the "on" state immediately.
- **A delivered push shows a real notification.** Since a real push
  service can't reach headless Chromium, the spec opens a raw CDP session
  and calls `ServiceWorker.deliverPushMessage` with the exact payload
  shape the sender would build (`{ title, body, url }`), then polls
  `serviceWorker.ready.getNotifications()` for the notification the
  service worker actually displayed — this is real `sw.js` code running,
  not a mock.
- **Proof.** The spec's own assertions are the proof; there's no separate
  screenshot step here (a notification isn't a DOM element to screenshot)
  — the `subs` row and the delivered notification's `{title, body, data}`
  in the test output are the evidence to paste.

## Gotchas

- Don't try to reuse `drive.mjs`'s `partner()`/`twoPartners()` for this —
  see "This one can't be driven through drive.mjs's shared browser" above.
- The 90s subscribe wait is real network latency to FCM, not a bug in the
  recipe — don't shorten the timeout.
- `context.close()` + `rmSync(profile, ...)` at the end are required
  cleanup for the persistent profile the spec creates under the OS tmp
  dir — this is separate from and in addition to this skill's own
  `scripts/cleanup.sh` (which only ever touches `.verify/<run-id>/` and
  the dev server process).
- A denied notification permission (e.g. a CI sandbox with no display) is
  a real environment limitation, not this feature failing — the spec's
  `permissions: ['notifications']` on the persistent context is what
  avoids that; don't drop it when adapting this recipe.
