import { timingSafeEqual } from 'node:crypto';
import webpush from 'web-push';
import { dispatch, type Send } from '@/features/notify/dispatch';
import { createAdminClient } from '@/lib/supabase-server';

const webPushSend: Send = (target, payload) =>
  webpush.sendNotification(target, payload, {
    TTL: 60 * 60 * 24,
    vapidDetails: {
      subject: process.env.VAPID_SUBJECT!,
      publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      privateKey: process.env.VAPID_PRIVATE_KEY!,
    },
  });

const same = (a: string, b: string) => {
  const [x, y] = [Buffer.from(a), Buffer.from(b)];
  return x.length === y.length && timingSafeEqual(x, y);
};

// Called only by the event_push trigger (pg_net), which sends the secret the database generated.
export async function POST(request: Request) {
  const db = createAdminClient();
  const { data: secret, error } = await db.rpc('push_dispatch_secret');
  if (error || !secret) return new Response('dispatch not configured', { status: 503 });
  if (!same(request.headers.get('x-push-secret') ?? '', secret)) return new Response(null, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const eventId = (body as { event_id?: unknown } | null)?.event_id;
  if (typeof eventId !== 'string') return new Response('event_id required', { status: 400 });
  return Response.json(await dispatch(db, eventId, webPushSend));
}
