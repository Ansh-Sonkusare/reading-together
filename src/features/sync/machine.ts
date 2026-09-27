export type SyncState =
  | { kind: 'solo' }
  | { kind: 'partnerHere' }
  | { kind: 'inviting' }
  | { kind: 'invited'; from: string }
  | { kind: 'leading' }
  | { kind: 'following'; leader: string };

export type Signal = 'invite' | 'accept' | 'decline' | 'leave';

// `by === me` is my own action; anything else arrived over broadcast from the partner.
export type SyncEvent = { type: 'presence'; present: string[] } | { type: Signal; by: string };

export type Notice = 'youLeft' | 'theyLeft' | 'theyWent' | 'declined' | null;

export const SOLO: SyncState = { kind: 'solo' };
const HERE: SyncState = { kind: 'partnerHere' };

const synced = (s: SyncState) => s.kind === 'leading' || s.kind === 'following';

export function reduce(s: SyncState, e: SyncEvent, me: string): SyncState {
  if (e.type === 'presence') {
    if (!e.present.some((id) => id !== me)) return s.kind === 'solo' ? s : SOLO;
    return s.kind === 'solo' ? HERE : s;
  }
  const mine = e.by === me;
  switch (e.type) {
    case 'invite':
      if (mine) return s.kind === 'partnerHere' ? { kind: 'inviting' } : s;
      if (s.kind === 'partnerHere') return { kind: 'invited', from: e.by };
      // Both invited at once: both sides pick the same leader without another round trip.
      if (s.kind === 'inviting') return me < e.by ? { kind: 'leading' } : { kind: 'following', leader: e.by };
      return s;
    case 'accept':
      if (mine) return s.kind === 'invited' ? { kind: 'following', leader: s.from } : s;
      return s.kind === 'inviting' ? { kind: 'leading' } : s;
    case 'decline':
      if (mine) return s.kind === 'invited' ? HERE : s;
      return s.kind === 'inviting' ? HERE : s;
    case 'leave':
      return s.kind === 'solo' || s.kind === 'partnerHere' ? s : HERE;
  }
}

export function noticeFor(prev: SyncState, next: SyncState, e: SyncEvent, me: string): Notice {
  if (synced(prev) && !synced(next)) {
    if (e.type === 'presence') return 'theyWent';
    return e.by === me ? 'youLeft' : 'theyLeft';
  }
  if (prev.kind === 'inviting' && next.kind === 'solo') return 'theyWent';
  if (prev.kind === 'inviting' && e.type === 'decline') return 'declined';
  return null;
}

export type Synced = { sync: SyncState; notice: Notice };

// The reducer React holds: a notice sticks until the next real transition.
export function step(s: Synced, e: SyncEvent, me: string): Synced {
  const next = reduce(s.sync, e, me);
  return next === s.sync ? s : { sync: next, notice: noticeFor(s.sync, next, e, me) };
}

const SIGNALS: readonly string[] = ['invite', 'accept', 'decline', 'leave'] satisfies Signal[];

// Broadcast payloads come from another client; accept only the shapes we send.
export function parseSignal(p: unknown): { type: Signal; by: string } | null {
  const o = p as { type?: unknown; by?: unknown } | null;
  return o && typeof o.by === 'string' && typeof o.type === 'string' && SIGNALS.includes(o.type) ? { type: o.type as Signal, by: o.by } : null;
}
