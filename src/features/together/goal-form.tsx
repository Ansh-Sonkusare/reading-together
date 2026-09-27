'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { setGoalAction, syncTimezone } from './goal-actions';
import type { Goal } from './streak';

export function GoalForm({ goal }: { goal: Goal | null }) {
  const [state, action, pending] = useActionState(setGoalAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2" aria-label="Reading goal">
      <label className="flex flex-col gap-1 text-sm">
        Daily goal
        <input
          className="w-24 rounded-md border px-3 py-2"
          name="target"
          type="number"
          min={1}
          max={1000}
          defaultValue={goal?.target ?? 10}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Unit
        <select className="rounded-md border px-3 py-2" name="kind" defaultValue={goal?.kind ?? 'pages_per_day'}>
          <option value="pages_per_day">pages a day</option>
          <option value="chapters_per_day">chapters a day</option>
        </select>
      </label>
      <Button type="submit" disabled={pending}>
        Set goal
      </Button>
      {state && 'error' in state && (
        <p role="alert" className="w-full text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function TimezoneSync({ current }: { current: string }) {
  const router = useRouter();
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz !== current) syncTimezone(tz).then(() => router.refresh());
  }, [current, router]);
  return null;
}
