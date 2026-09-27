import { describe, expect, it } from 'vitest';
import { parsePrefs } from './prefs';

describe('parsePrefs', () => {
  it('keeps valid prefs', () => {
    expect(parsePrefs('{"theme":"night","fontScale":1.4,"background":"#102030"}')).toEqual({ theme: 'night', fontScale: 1.4, background: '#102030' });
    expect(parsePrefs('{"theme":"sepia","fontScale":0.8}')).toEqual({ theme: 'sepia', fontScale: 0.8 });
  });

  it('falls back to defaults on missing or malformed JSON', () => {
    expect(parsePrefs(null)).toEqual({ theme: 'light', fontScale: 1 });
    expect(parsePrefs('{theme:')).toEqual({ theme: 'light', fontScale: 1 });
    expect(parsePrefs('null')).toEqual({ theme: 'light', fontScale: 1 });
    expect(parsePrefs('"dark"')).toEqual({ theme: 'light', fontScale: 1 });
  });

  it('defaults each bad field on its own', () => {
    expect(parsePrefs('{"theme":"neon","fontScale":1.2}')).toEqual({ theme: 'light', fontScale: 1.2 });
    expect(parsePrefs('{"theme":"toString","fontScale":1.2}')).toEqual({ theme: 'light', fontScale: 1.2 });
    expect(parsePrefs('{"theme":"dark","fontScale":2}')).toEqual({ theme: 'dark', fontScale: 1 });
    expect(parsePrefs('{"theme":"dark","fontScale":0.5}')).toEqual({ theme: 'dark', fontScale: 1 });
    expect(parsePrefs('{"theme":"dark","fontScale":"1.2"}')).toEqual({ theme: 'dark', fontScale: 1 });
  });

  it('drops a background that is not a plain hex colour', () => {
    expect(parsePrefs('{"theme":"dark","fontScale":1,"background":"red;} body{display:none"}')).toEqual({ theme: 'dark', fontScale: 1 });
    expect(parsePrefs('{"theme":"dark","fontScale":1,"background":"#fff"}')).toEqual({ theme: 'dark', fontScale: 1 });
  });
});
