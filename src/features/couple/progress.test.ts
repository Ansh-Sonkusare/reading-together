import { afterEach, expect, it, vi } from 'vitest';
import { createProgressSaver } from './progress';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('retries a failed save on its own, so the saved position catches up without another page turn', async () => {
  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValue(new Response(null, { status: 201 }));
  vi.stubGlobal('fetch', fetch);
  const saved: [number, number][] = [];
  const saver = createProgressSaver('book', 'me', null, (pos, maxPos) => saved.push([pos, maxPos]));

  saver.save(2.5, 2.6, null);
  await vi.advanceTimersByTimeAsync(1000);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(saved).toEqual([]);

  await vi.runAllTimersAsync();
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ user_id: 'me', book_id: 'book', pos: 2.5, max_pos: 2.6, locator: null });
  expect(saved).toEqual([[2.5, 2.6]]);
});

it('a retry sends the newest position when the reader turned a page meanwhile', async () => {
  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const fetch = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(new Response(null, { status: 201 }));
  vi.stubGlobal('fetch', fetch);
  const saved: [number, number][] = [];
  const saver = createProgressSaver('book', 'me', null, (pos, maxPos) => saved.push([pos, maxPos]));

  saver.save(2.5, 2.6, null);
  await vi.advanceTimersByTimeAsync(1000);
  saver.save(2.7, 2.8, null);
  await vi.runAllTimersAsync();
  expect(fetch.mock.calls.slice(1).map((c) => JSON.parse(c[1].body).pos)).toEqual([2.7]);
  expect(saved).toEqual([[2.7, 2.8]]);
});

it('a page turned while a doomed save is in flight still saves after the normal debounce, not the retry delay', async () => {
  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  let fail!: (e: Error) => void;
  const fetch = vi
    .fn()
    .mockReturnValueOnce(new Promise((_, reject) => (fail = reject)))
    .mockResolvedValue(new Response(null, { status: 201 }));
  vi.stubGlobal('fetch', fetch);
  const saved: [number, number][] = [];
  const saver = createProgressSaver('book', 'me', null, (pos, maxPos) => saved.push([pos, maxPos]));

  saver.save(2.5, 2.6, null);
  await vi.advanceTimersByTimeAsync(1000);
  saver.save(2.7, 2.8, null);
  fail(new TypeError('Failed to fetch'));
  await vi.advanceTimersByTimeAsync(1000);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(saved).toEqual([[2.7, 2.8]]);
});
