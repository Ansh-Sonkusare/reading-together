export type Placed = { id: string; top: number; height: number };

// Notes that would land on each other slide down just enough to clear the one above.
export function stack(items: Placed[], gap = 12): Map<string, number> {
  const out = new Map<string, number>();
  let floor = -Infinity;
  for (const { id, top, height } of [...items].sort((a, b) => a.top - b.top)) {
    const at = Math.max(top, floor);
    out.set(id, at);
    floor = at + height + gap;
  }
  return out;
}

// A hair of tilt that stays put across renders: -1.5° to 1.5° from the id.
export function tilt(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 7) - 3) * 0.5;
}
