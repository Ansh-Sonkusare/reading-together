import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

// Realtime keys a postgres_changes subscription by its params, so leaving an old channel after an identical
// one has joined (a StrictMode or fast remount) silently kills the new one. Joins wait for the last leave.
let lastLeave: Promise<unknown> = Promise.resolve();

// Joins `name` once the previous leave resolved and Realtime holds the session token; returns the leave.
export function joinChannel(
  db: Pick<SupabaseClient, 'auth' | 'realtime' | 'channel' | 'removeChannel'>,
  name: string,
  listen: (channel: RealtimeChannel) => RealtimeChannel,
  onSubscribed: () => void,
): () => void {
  let channel: RealtimeChannel | null = null;
  let live = true;
  void lastLeave.then(async () => {
    const { data } = await db.auth.getSession();
    if (!live) return;
    // Without this the join can go out before the client has handed Realtime the session, and RLS then sees anon.
    await db.realtime.setAuth(data.session?.access_token ?? null);
    if (!live) return;
    channel = listen(db.channel(name)).subscribe((status) => status === 'SUBSCRIBED' && onSubscribed());
  });
  return () => {
    live = false;
    if (channel) lastLeave = db.removeChannel(channel);
  };
}
