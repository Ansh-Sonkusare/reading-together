import { execSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { streak } from '../../src/features/together/streak';
import type { Database } from '@/lib/types';

type Client = SupabaseClient<Database>;
type User = { id: string; db: Client };

const env: Record<string, string> = JSON.parse(
  execSync('pnpm exec supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
);
const url = env.API_URL;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient<Database>(url, env.SERVICE_ROLE_KEY, opts);
const run = Date.now().toString(36);

async function user(label: string): Promise<User> {
  const email = `streak-${label}-${run}@test.local`;
  const password = 'password-123';
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const db = createClient<Database>(url, env.ANON_KEY, opts);
  const signed = await db.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  return { id: created.data.user.id, db };
}

async function ok<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw error;
  if (data == null) throw new Error('no data');
  return data;
}

async function write(p: PromiseLike<{ error: unknown }>) {
  const { error } = await p;
  if (error) throw error;
}

const localDay = (timeZone: string) => new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());

const setPos = (u: User, bookId: string, pos: number) =>
  write(u.db.from('progress').upsert({ user_id: u.id, book_id: bookId, pos, max_pos: pos }));

const open = (u: User, bookId: string) =>
  write(u.db.from('progress').insert({ user_id: u.id, book_id: bookId, pos: 0, max_pos: 0 }));

const days = (u: User, bookId: string) =>
  ok(u.db.from('reading_day').select('user_id, day, from_max_pos, to_max_pos').eq('book_id', bookId).order('day'));

async function couple(a: User, b: User, spine_lengths: number[]) {
  const invite = await ok(a.db.rpc('create_couple', { name: 'Alex', color: '#e11d48' }));
  const coupleId = await ok(b.db.rpc('join_couple', { invite_code: invite, name: 'Sam' }));
  const book = await ok(admin.from('book').insert({ couple_id: coupleId, title: 'T', added_by: a.id, spine_lengths }).select('id').single());
  await Promise.all([open(a, book.id), open(b, book.id)]);
  return { coupleId, bookId: book.id };
}

let A: User, B: User, C: User, D: User, E: User;
let AB: { coupleId: string; bookId: string };
let DE: { coupleId: string; bookId: string };
let cBook: string;

beforeAll(async () => {
  [A, B, C, D, E] = await Promise.all(['a', 'b', 'c', 'd', 'e'].map(user));
  AB = await couple(A, B, [3000, 3000]);
  DE = await couple(D, E, [3000, 3000]);
  const cCouple = await ok(C.db.rpc('create_couple', { name: 'Cam', color: '#2563eb' }).then(() => C.db.from('member').select('couple_id').single()));
  cBook = (await ok(admin.from('book').insert({ couple_id: cCouple.couple_id, title: 'C', added_by: C.id, spine_lengths: [3000] }).select('id').single())).id;
  await open(C, cBook);
});

describe('opening a book', () => {
  it('is not a reading day; the first page turned is', async () => {
    const book = (await ok(admin.from('book').insert({ couple_id: AB.coupleId, title: 'O', added_by: A.id, spine_lengths: [3000] }).select('id').single())).id;
    await write(A.db.from('progress').insert({ user_id: A.id, book_id: book, pos: 0.3, max_pos: 0.3 }));
    expect(await days(A, book)).toEqual([]);
    await setPos(A, book, 0.4);
    expect(await days(A, book)).toEqual([{ user_id: A.id, day: localDay('UTC'), from_max_pos: 0.3, to_max_pos: 0.4 }]);
  });
});

describe('member.timezone', () => {
  it('a member sets their own timezone, not their partner’s, and only a real zone', async () => {
    await write(A.db.from('member').update({ timezone: 'Pacific/Kiritimati' }).eq('user_id', A.id));
    const own = await ok(A.db.from('member').select('user_id, timezone').eq('couple_id', AB.coupleId).order('name'));
    expect(own).toEqual([
      { user_id: A.id, timezone: 'Pacific/Kiritimati' },
      { user_id: B.id, timezone: 'UTC' },
    ]);

    const partner = await A.db.from('member').update({ timezone: 'Asia/Tokyo' }).eq('user_id', B.id).select();
    expect(partner.data).toEqual([]);
    expect((await ok(admin.from('member').select('timezone').eq('user_id', B.id).single())).timezone).toBe('UTC');

    const bogus = await A.db.from('member').update({ timezone: 'Mars/Olympus' }).eq('user_id', A.id);
    expect(bogus.error?.code).toBe('23514');
  });
});

describe('reading_day trigger', () => {
  it('records the first and latest max_pos of the reader’s local day, ignoring moves back', async () => {
    const today = localDay('Pacific/Kiritimati');
    await setPos(A, AB.bookId, 0.2);
    expect(await days(A, AB.bookId)).toEqual([{ user_id: A.id, day: today, from_max_pos: 0, to_max_pos: 0.2 }]);

    await setPos(A, AB.bookId, 0.7);
    expect(await days(A, AB.bookId)).toEqual([{ user_id: A.id, day: today, from_max_pos: 0, to_max_pos: 0.7 }]);

    await setPos(A, AB.bookId, 0.1);
    expect(await days(A, AB.bookId)).toEqual([{ user_id: A.id, day: today, from_max_pos: 0, to_max_pos: 0.7 }]);
  });

  it('counts pages read today in reading_today', async () => {
    // 0 → 0.7 of a 3000-char spine = 2100 chars = 1 page.
    const rows = await ok(A.db.from('reading_today').select('user_id, day, pages, chapters').eq('user_id', A.id));
    expect(rows).toEqual([{ user_id: A.id, day: localDay('Pacific/Kiritimati'), pages: 1, chapters: 0 }]);
  });
});

describe('streak days', () => {
  it('both partners reading today extends the streak built from past days', async () => {
    await write(B.db.from('member').update({ timezone: 'Pacific/Kiritimati' }).eq('user_id', B.id));
    await setPos(B, AB.bookId, 0.3);
    const aToday = localDay('Pacific/Kiritimati');
    const back = (n: number) => new Date(Date.parse(`${aToday}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
    await write(
      admin.from('reading_day').insert([
        { user_id: A.id, book_id: AB.bookId, day: back(1), from_max_pos: 0, to_max_pos: 0.1 },
        { user_id: B.id, book_id: AB.bookId, day: back(1), from_max_pos: 0, to_max_pos: 0.1 },
        { user_id: A.id, book_id: AB.bookId, day: back(2), from_max_pos: 0, to_max_pos: 0.1 },
        { user_id: A.id, book_id: AB.bookId, day: back(3), from_max_pos: 0, to_max_pos: 0.1 },
        { user_id: B.id, book_id: AB.bookId, day: back(3), from_max_pos: 0, to_max_pos: 0.1 },
      ]),
    );
    const rows = await days(A, AB.bookId);
    const of = (u: User) => rows.filter((r) => r.user_id === u.id).map((r) => r.day);
    expect(of(B)).toEqual([back(3), back(1), aToday]);
    expect(streak(of(A), of(B), aToday)).toBe(2);
  });
});

describe('goal', () => {
  it('a goal set by one partner is visible to the other, and to no one else', async () => {
    await write(B.db.rpc('set_goal', { kind: 'pages_per_day', target: 10 }));
    expect(await ok(A.db.from('goal').select('couple_id, kind, target, updated_by'))).toEqual([
      { couple_id: AB.coupleId, kind: 'pages_per_day', target: 10, updated_by: B.id },
    ]);

    await write(A.db.rpc('set_goal', { kind: 'chapters_per_day', target: 1 }));
    expect(await ok(B.db.from('goal').select('kind, target, updated_by'))).toEqual([{ kind: 'chapters_per_day', target: 1, updated_by: A.id }]);

    expect(await ok(C.db.from('goal').select('couple_id'))).toEqual([]);
    await write(C.db.rpc('set_goal', { kind: 'pages_per_day', target: 5 }));
    expect(await ok(C.db.from('goal').select('kind, target'))).toEqual([{ kind: 'pages_per_day', target: 5 }]);
    expect(await ok(B.db.from('goal').select('kind, target'))).toEqual([{ kind: 'chapters_per_day', target: 1 }]);

    const zero = await A.db.rpc('set_goal', { kind: 'pages_per_day', target: 0 });
    expect(zero.error?.code).toBe('23514');
  });

  it('goal_met fires once when the day total crosses a pages target', async () => {
    await write(D.db.rpc('set_goal', { kind: 'pages_per_day', target: 2 }));
    const goalMet = () => ok(E.db.from('event').select('actor_id, data').eq('type', 'goal_met').eq('couple_id', DE.coupleId));

    await setPos(D, DE.bookId, 0.5); // 1500 chars = 1 page
    expect(await goalMet()).toEqual([]);

    await setPos(D, DE.bookId, 1); // 3000 chars = 2 pages
    const met = [{ actor_id: D.id, data: { day: localDay('UTC'), kind: 'pages_per_day', target: 2 } }];
    expect(await goalMet()).toEqual(met);

    await setPos(D, DE.bookId, 1.9);
    expect(await goalMet()).toEqual(met);
  });

  it('goal_met counts a chapter finished in the same progress update', async () => {
    await setPos(E, DE.bookId, 0.9);
    await write(E.db.rpc('set_goal', { kind: 'chapters_per_day', target: 1 }));
    const eMet = () => ok(D.db.from('event').select('data').eq('type', 'goal_met').eq('actor_id', E.id));
    await setPos(E, DE.bookId, 0.95);
    expect(await eMet()).toEqual([]);

    await setPos(E, DE.bookId, 1.1);
    expect(await eMet()).toEqual([{ data: { day: localDay('UTC'), kind: 'chapters_per_day', target: 1 } }]);
  });
});

describe('front matter', () => {
  it('a spine before the first TOC entry counts as no chapter in reading_today or the chapter goal', async () => {
    const [F, G] = await Promise.all(['f', 'g'].map(user));
    const invite = await ok(F.db.rpc('create_couple', { name: 'Fen', color: '#e11d48' }));
    const coupleId = await ok(G.db.rpc('join_couple', { invite_code: invite, name: 'Gus' }));
    const toc = [{ spine: 1, label: 'Chapter I' }, { spine: 2, label: 'Chapter II' }];
    const book = (await ok(admin.from('book').insert({ couple_id: coupleId, title: 'FM', added_by: F.id, spine_lengths: [3000, 3000, 3000], toc }).select('id').single())).id;
    await open(F, book);
    await write(F.db.rpc('set_goal', { kind: 'chapters_per_day', target: 1 }));
    const today = () => ok(G.db.from('reading_today').select('chapters').eq('user_id', F.id));
    const met = () => ok(G.db.from('event').select('data').eq('type', 'goal_met').eq('actor_id', F.id));

    await setPos(F, book, 1.1);
    expect((await ok(G.db.from('event').select('data').eq('type', 'chapter_finished').eq('actor_id', F.id))).map((e) => e.data)).toEqual([{ spine: 0 }]);
    expect(await today()).toEqual([{ chapters: 0 }]);
    expect(await met()).toEqual([]);

    await setPos(F, book, 2.1);
    expect(await today()).toEqual([{ chapters: 1 }]);
    expect(await met()).toEqual([{ data: { day: localDay('UTC'), kind: 'chapters_per_day', target: 1 } }]);
  });
});

describe('couple scope', () => {
  it('an outsider sees none of the couple’s reading days or today totals, only their own', async () => {
    await setPos(C, cBook, 0.5);
    expect(await ok(C.db.from('reading_day').select('user_id'))).toEqual([{ user_id: C.id }]);
    expect(await ok(C.db.from('reading_day').select('user_id').eq('book_id', AB.bookId))).toEqual([]);
    expect(await ok(C.db.from('reading_today').select('user_id, pages'))).toEqual([{ user_id: C.id, pages: 1 }]);
    expect(await ok(C.db.from('event').select('id').eq('type', 'goal_met').eq('couple_id', DE.coupleId))).toEqual([]);
    expect((await ok(E.db.from('event').select('id').eq('type', 'goal_met').eq('couple_id', DE.coupleId))).length).toBe(2);
  });
});
