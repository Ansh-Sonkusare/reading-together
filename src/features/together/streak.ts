export type GoalKind = 'pages_per_day' | 'chapters_per_day';
export type Goal = { kind: GoalKind; target: number };

const dayBefore = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

// Consecutive days on which both partners read, ending today, or yesterday if today isn't done yet.
export function streak(daysA: string[], daysB: string[], today: string): number {
  const b = new Set(daysB);
  const both = new Set(daysA.filter((d) => b.has(d)));
  let day = both.has(today) ? today : dayBefore(today);
  let n = 0;
  while (both.has(day)) {
    n++;
    day = dayBefore(day);
  }
  return n;
}

export function streakText(n: number): string {
  return n === 0 ? 'Start a streak: read today together' : `🔥 ${n}-day reading streak`;
}

const UNITS: Record<GoalKind, [string, string]> = {
  pages_per_day: ['page', 'pages'],
  chapters_per_day: ['chapter', 'chapters'],
};

export function goalProgressText(goal: Goal, readers: { name: string; done: number }[]): string {
  const [one, many] = UNITS[goal.kind];
  const parts = readers.map(({ name, done }, i) => {
    const unit = i === 0 ? ` ${goal.target === 1 ? one : many}` : '';
    return `${name} ${done}/${goal.target}${unit}${done >= goal.target ? ' ✓' : ''}`;
  });
  return `Today: ${parts.join(' · ')}`;
}
