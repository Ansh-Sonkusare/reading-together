// Same order as inks() in supabase/migrations/20260927001300_partner_inks.sql.
export const INKS = [
  { name: 'Rose', color: '#d6336c' },
  { name: 'Cobalt', color: '#3b5bdb' },
  { name: 'Jade', color: '#0ca678' },
  { name: 'Amber', color: '#e8890c' },
  { name: 'Violet', color: '#7048e8' },
  { name: 'Teal', color: '#1098ad' },
] as const;
export type Color = (typeof INKS)[number]['color'];
export const COLORS: readonly Color[] = INKS.map((i) => i.color);
export const inkName = (color: string) => INKS.find((i) => i.color === color.toLowerCase())?.name ?? 'Ink';
