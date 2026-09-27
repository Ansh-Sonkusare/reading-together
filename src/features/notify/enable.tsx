'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { createBrowserClient } from '@/lib/supabase';

type State = 'loading' | 'unsupported' | 'off' | 'on' | 'denied' | 'error';

const supported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function vapidKey(base64url: string): Uint8Array<ArrayBuffer> {
  const bin = atob(base64url.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// Never prompts on load: the permission request only follows a click.
export function EnableNotifications() {
  const [state, setState] = useState<State>('loading');

  useEffect(() => {
    if (!supported()) return setState('unsupported');
    if (Notification.permission === 'denied') return setState('denied');
    navigator.serviceWorker
      .getRegistration('/')
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setState(sub && Notification.permission === 'granted' ? 'on' : 'off'))
      .catch(() => setState('off'));
  }, []);

  async function enable() {
    try {
      if ((await Notification.requestPermission()) !== 'granted') return setState('denied');
      await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) }));
      const { endpoint, keys } = sub.toJSON();
      const { error } = await createBrowserClient()
        .from('push_sub')
        .upsert({ endpoint: endpoint!, keys: keys! }, { onConflict: 'user_id,endpoint' });
      if (error) throw error;
      setState('on');
    } catch (e) {
      console.error('enable notifications failed', e);
      setState('error');
    }
  }

  if (state === 'loading' || state === 'unsupported') return null;
  return (
    <section className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-6 text-sm text-muted-foreground" aria-label="Notifications">
      {state === 'on' ? (
        <p data-testid="notifications">🔔 Notifications are on</p>
      ) : state === 'denied' ? (
        <p data-testid="notifications">Notifications are blocked in this browser&apos;s site settings.</p>
      ) : (
        <>
          <p>Want a nudge when your partner reacts, replies or finishes a chapter?</p>
          <Button variant="outline" size="sm" onClick={enable}>
            Enable notifications
          </Button>
          {state === 'error' && (
            <p role="alert" className="w-full text-danger">
              Couldn&apos;t turn on notifications. Try again.
            </p>
          )}
        </>
      )}
    </section>
  );
}
