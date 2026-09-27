import { expect, it } from 'vitest';
import { parseSignal, reduce, SOLO, step, type SyncEvent, type SyncState } from './machine';

const A = 'user-a';
const B = 'user-b';
const here: SyncState = { kind: 'partnerHere' };
const run = (me: string, events: SyncEvent[], from: SyncState = SOLO) => events.reduce((s, e) => reduce(s, e, me), from);

it('presence moves solo ↔ partnerHere and ignores my own presence', () => {
  expect(reduce(SOLO, { type: 'presence', present: [A] }, A)).toEqual(SOLO);
  expect(reduce(SOLO, { type: 'presence', present: [A, B] }, A)).toEqual(here);
  expect(reduce(here, { type: 'presence', present: [A] }, A)).toEqual(SOLO);
});

it('invite → accept makes the inviter lead and the invitee follow', () => {
  const a = run(A, [{ type: 'presence', present: [A, B] }, { type: 'invite', by: A }]);
  expect(a).toEqual({ kind: 'inviting' });
  const b = run(B, [{ type: 'presence', present: [A, B] }, { type: 'invite', by: A }]);
  expect(b).toEqual({ kind: 'invited', from: A });
  expect(reduce(b, { type: 'accept', by: B }, B)).toEqual({ kind: 'following', leader: A });
  expect(reduce(a, { type: 'accept', by: B }, A)).toEqual({ kind: 'leading' });
});

it('decline returns both sides to partnerHere', () => {
  expect(reduce({ kind: 'invited', from: A }, { type: 'decline', by: B }, B)).toEqual(here);
  expect(reduce({ kind: 'inviting' }, { type: 'decline', by: B }, A)).toEqual(here);
});

it('invalid transitions leave the state unchanged', () => {
  expect(reduce(here, { type: 'accept', by: B }, A)).toBe(here);
  expect(reduce(here, { type: 'accept', by: A }, A)).toBe(here);
  expect(reduce(SOLO, { type: 'invite', by: A }, A)).toBe(SOLO);
  expect(reduce(SOLO, { type: 'invite', by: B }, A)).toBe(SOLO);
  expect(reduce(here, { type: 'decline', by: B }, A)).toBe(here);
  const leading: SyncState = { kind: 'leading' };
  expect(reduce(leading, { type: 'invite', by: B }, A)).toBe(leading);
  expect(reduce(leading, { type: 'accept', by: B }, A)).toBe(leading);
  expect(reduce(here, { type: 'leave', by: B }, A)).toBe(here);
});

it('either side leaving ends sync; the partner leaving the book goes solo', () => {
  const following: SyncState = { kind: 'following', leader: A };
  expect(reduce(following, { type: 'leave', by: B }, B)).toEqual(here);
  expect(reduce({ kind: 'leading' }, { type: 'leave', by: B }, A)).toEqual(here);
  expect(reduce(following, { type: 'presence', present: [B] }, B)).toEqual(SOLO);
  expect(reduce({ kind: 'leading' }, { type: 'presence', present: [A] }, A)).toEqual(SOLO);
  expect(reduce({ kind: 'inviting' }, { type: 'leave', by: A }, A)).toEqual(here);
});

it('simultaneous invites resolve to the same leader on both sides', () => {
  expect(reduce({ kind: 'inviting' }, { type: 'invite', by: B }, A)).toEqual({ kind: 'leading' });
  expect(reduce({ kind: 'inviting' }, { type: 'invite', by: A }, B)).toEqual({ kind: 'following', leader: A });
});

it('step records why sync ended', () => {
  const following = { sync: { kind: 'following', leader: A } as SyncState, notice: null };
  expect(step(following, { type: 'leave', by: B }, B)).toEqual({ sync: here, notice: 'youLeft' });
  expect(step({ sync: { kind: 'leading' }, notice: null }, { type: 'leave', by: B }, A)).toEqual({ sync: here, notice: 'theyLeft' });
  expect(step(following, { type: 'presence', present: [B] }, B)).toEqual({ sync: SOLO, notice: 'theyWent' });
  expect(step({ sync: { kind: 'inviting' }, notice: null }, { type: 'decline', by: B }, A)).toEqual({ sync: here, notice: 'declined' });
  const s = { sync: here, notice: 'theyLeft' as const };
  expect(step(s, { type: 'accept', by: B }, A)).toBe(s);
});

it('parseSignal accepts only the signals we send', () => {
  expect(parseSignal({ type: 'invite', by: A })).toEqual({ type: 'invite', by: A });
  expect(parseSignal({ type: 'presence', by: A })).toBeNull();
  expect(parseSignal({ type: 'invite' })).toBeNull();
  expect(parseSignal(null)).toBeNull();
});
