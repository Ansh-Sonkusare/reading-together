-- Trigger functions are never RPCs. Hosted Supabase grants EXECUTE on new functions to anon/authenticated,
-- so revoke explicitly (advisor lints 0028/0029). Helpers used by RLS and the signed-in RPCs stay granted.
revoke execute on function
  public.event_on_answer(), public.event_on_book(), public.event_on_mark(), public.event_on_progress(),
  public.event_on_mark_delete(), public.push_on_event(), public.reading_day_on_progress(),
  public.mark_color_not_partners(), public.enforce_two_members(), public.progress_high_water()
  from public, anon, authenticated;
