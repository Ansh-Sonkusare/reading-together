'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type { ReaderHandle, ReaderTheme } from './reader';

export const THEMES = {
  light: { background: '#fbfafd', color: '#26243a' },
  sepia: { background: '#f4ecd8', color: '#5b4636' },
  dark: { background: '#17161f', color: '#eceaf4' },
  night: { background: '#000000', color: '#a8a29e' },
} as const satisfies Record<string, ReaderTheme>;
export type ThemeName = keyof typeof THEMES;

export type Prefs = { theme: ThemeName; fontScale: number; background?: string };
export const DEFAULT_PREFS: Prefs = { theme: 'light', fontScale: 1 };
export const FONT_SCALES = [0.8, 0.9, 1, 1.1, 1.2, 1.4, 1.6];

const KEY = 'reader:prefs';
// The background lands in CSS inside the book iframe, so only a plain hex colour gets through.
const HEX = /^#[0-9a-f]{6}$/i;

export function parsePrefs(raw: string | null): Prefs {
  let v: unknown;
  try {
    v = JSON.parse(raw ?? '');
  } catch {
    return DEFAULT_PREFS;
  }
  if (typeof v !== 'object' || v === null) return DEFAULT_PREFS;
  const o = v as Record<string, unknown>;
  const theme = typeof o.theme === 'string' && Object.hasOwn(THEMES, o.theme) ? (o.theme as ThemeName) : DEFAULT_PREFS.theme;
  const fontScale = typeof o.fontScale === 'number' && o.fontScale >= 0.8 && o.fontScale <= 1.6 ? o.fontScale : DEFAULT_PREFS.fontScale;
  return typeof o.background === 'string' && HEX.test(o.background) ? { theme, fontScale, background: o.background } : { theme, fontScale };
}

export const themeOf = (p: Prefs): ReaderTheme => ({ ...THEMES[p.theme], ...(p.background && { background: p.background }) });

const listeners = new Set<() => void>();
let cache: { raw: string | null; prefs: Prefs } = { raw: null, prefs: DEFAULT_PREFS };

function snapshot(): Prefs {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {}
  if (raw !== cache.raw) cache = { raw, prefs: parsePrefs(raw) };
  return cache.prefs;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener('storage', cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', cb);
  };
}

export function usePrefs(): [Prefs, (patch: Partial<Prefs>) => void] {
  const prefs = useSyncExternalStore(subscribe, snapshot, () => DEFAULT_PREFS);
  const update = (patch: Partial<Prefs>) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...snapshot(), ...patch }));
    } catch {}
    for (const cb of listeners) cb();
  };
  return [prefs, update];
}

export type AppTheme = 'light' | 'dark' | 'system';
const APP_KEY = 'app:theme';

function storedAppTheme(): AppTheme {
  try {
    const t = localStorage.getItem(APP_KEY);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

// Mirrors the pre-paint script in app/layout.tsx.
function setAppTheme(t: AppTheme) {
  try {
    localStorage.setItem(APP_KEY, t);
  } catch {}
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  for (const cb of listeners) cb();
}

function useAppTheme(): [AppTheme, (t: AppTheme) => void] {
  return [useSyncExternalStore(subscribe, storedAppTheme, () => 'system' as const), setAppTheme];
}

export function ReaderPrefs({ handle }: { handle: ReaderHandle | null }) {
  const [prefs, update] = usePrefs();
  const [app, setApp] = useAppTheme();
  const { background } = themeOf(prefs);

  useEffect(() => {
    handle?.setTheme(themeOf(prefs));
    handle?.setFontScale(prefs.fontScale);
  }, [handle, prefs]);

  const select = 'h-8 min-w-28 rounded-full border border-rule bg-paper px-3 text-sm text-foreground outline-none focus-visible:border-pencil';
  const row = 'flex items-center justify-between gap-4 text-sm';
  return (
    <span className="flex flex-col gap-2.5">
      <label className={row}>
        <span className="text-pencil">Page</span>
        <select aria-label="Reading theme" className={select} value={prefs.theme} onChange={(e) => update({ theme: e.target.value as ThemeName, background: undefined })}>
          {Object.keys(THEMES).map((t) => (
            <option key={t} value={t}>
              {t[0].toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <label className={row}>
        <span className="text-pencil">Text size</span>
        <select aria-label="Text size" className={select} value={prefs.fontScale} onChange={(e) => update({ fontScale: Number(e.target.value) })}>
          {FONT_SCALES.map((s) => (
            <option key={s} value={s}>
              {Math.round(s * 100)}%
            </option>
          ))}
        </select>
      </label>
      <label className={row}>
        <span className="text-pencil">Page colour</span>
        <input
          aria-label="Reading background"
          type="color"
          className="h-8 w-12 cursor-pointer rounded-full border border-rule bg-paper p-1 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
          value={background}
          onChange={(e) => update({ background: e.target.value })}
        />
      </label>
      <label className={row}>
        <span className="text-pencil">App</span>
        <select aria-label="App theme" className={select} value={app} onChange={(e) => setApp(e.target.value as AppTheme)}>
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
    </span>
  );
}
