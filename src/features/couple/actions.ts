'use server';

import { redirect } from 'next/navigation';
import { createUserClient } from '@/lib/supabase-server';
import { createCouple, joinCouple, parseProfile, type Result } from './couple';

function safeNext(form: FormData): string {
  const next = String(form.get('next') ?? '');
  return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

function credentials(form: FormData) {
  return { email: String(form.get('email') ?? '').trim(), password: String(form.get('password') ?? '') };
}

export async function signIn(_: Result, form: FormData): Promise<Result> {
  const db = await createUserClient();
  const { error } = await db.auth.signInWithPassword(credentials(form));
  if (error) return { error: 'Wrong email or password.' };
  redirect(safeNext(form));
}

export async function signUp(_: Result, form: FormData): Promise<Result> {
  const { email, password } = credentials(form);
  if (password.length < 6) return { error: 'Use a password of at least 6 characters.' };
  const db = await createUserClient();
  const { error } = await db.auth.signUp({ email, password });
  if (error) return { error: error.code === 'user_already_exists' ? 'That email already has an account. Sign in instead.' : error.message };
  redirect(safeNext(form));
}

export async function signOut() {
  const db = await createUserClient();
  await db.auth.signOut();
  redirect('/login');
}

export async function createCoupleAction(_: Result, form: FormData): Promise<Result> {
  const profile = parseProfile(form);
  if ('error' in profile) return profile;
  const result = await createCouple(profile.name, profile.color);
  if (result) return result;
  redirect('/library');
}

export async function joinCoupleAction(_: Result, form: FormData): Promise<Result> {
  const profile = parseProfile(form);
  if ('error' in profile) return profile;
  const result = await joinCouple(String(form.get('code') ?? ''), profile.name, profile.color);
  if (result) return result;
  redirect('/library');
}

export async function openInvite(form: FormData) {
  const code = String(form.get('code') ?? '').trim().split('/').filter(Boolean).pop() ?? '';
  redirect(`/join/${encodeURIComponent(code)}`);
}
