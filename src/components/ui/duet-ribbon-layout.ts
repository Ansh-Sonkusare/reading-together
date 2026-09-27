export type RibbonMark = { name: string; color: string; page: number; pos: number; isMe: boolean };

export const ribbonLabel = (m: Pick<RibbonMark, 'name' | 'page' | 'isMe'>) => `${m.isMe ? 'you' : m.name} p.${m.page}`;

export const ribbonX = (pos: number, total: number) => (total > 0 ? Math.min(1, Math.max(0, pos / total)) : 0);

/**
 * Left edge (px) and row of each label so none overlap: centred under its ribbon, clamped to the track,
 * pushed apart by `gap`. If they can't all fit on one row, every other label drops to row 1.
 * `labels[i].x` is the ribbon position in 0..1, `w` the measured label width in px. Output keeps input order.
 */
export function layoutLabels(labels: { x: number; w: number }[], width: number, gap = 8): { left: number; row: number }[] {
  const order = labels.map((_, i) => i).sort((a, b) => labels[a].x - labels[b].x || a - b);
  const out = labels.map(() => ({ left: 0, row: 0 }));
  const need = labels.reduce((s, l) => s + l.w, 0) + gap * Math.max(0, labels.length - 1);
  const rows = need > width ? [order.filter((_, k) => k % 2 === 0), order.filter((_, k) => k % 2 === 1)] : [order];

  rows.forEach((row, r) => {
    const left = row.map((i) => clamp(labels[i].x * width - labels[i].w / 2, 0, Math.max(0, width - labels[i].w)));
    for (let k = 1; k < row.length; k++) left[k] = Math.max(left[k], left[k - 1] + labels[row[k - 1]].w + gap);
    for (let k = row.length - 1; k >= 0; k--) {
      const limit = k === row.length - 1 ? width - labels[row[k]].w : left[k + 1] - gap - labels[row[k]].w;
      left[k] = Math.max(0, Math.min(left[k], limit));
    }
    row.forEach((i, k) => (out[i] = { left: Math.round(left[k]), row: r }));
  });
  return out;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
