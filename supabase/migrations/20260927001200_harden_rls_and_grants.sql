-- Supabase advisors + security checklist, 2026-09-27.
-- 1. RLS policies call auth.uid() once per query, not once per row (lint 0003). Generated from pg_policies.
alter policy answer_insert on public.answer
  with check (((user_id = (select auth.uid())) AND is_couple_member(book_couple_id(book_id))));
alter policy answer_select on public.answer
  using (((user_id = (select auth.uid())) OR (is_couple_member(book_couple_id(book_id)) AND i_answered(book_id, spine, prompt_key, kind))));
alter policy event_select on public.event
  using ((is_couple_member(couple_id) AND ((pos IS NULL) OR (actor_id = (select auth.uid())) OR (pos <= my_max_pos(book_id)))));
alter policy mark_delete on public.mark
  using ((author_id = (select auth.uid())));
alter policy mark_insert on public.mark
  with check (((author_id = (select auth.uid())) AND is_couple_member(book_couple_id(book_id)) AND (pos <= (my_max_pos(book_id) + 0.000000001)) AND ((parent_id IS NULL) OR (EXISTS ( SELECT 1
   FROM mark p
  WHERE ((p.id = mark.parent_id) AND (p.book_id = mark.book_id))))) AND memory_media_ok(kind, media_url, book_id, id)));
-- mark_select keeps plain auth.uid(): a sub-select here plus mark_insert's EXISTS on mark makes Postgres
-- report infinite recursion in the mark policies. One per-row auth.uid() call is the cheaper trade.
alter policy mark_update on public.mark
  using ((author_id = (select auth.uid())))
  with check (((author_id = (select auth.uid())) AND is_couple_member(book_couple_id(book_id)) AND (pos <= (my_max_pos(book_id) + 0.000000001)) AND memory_media_ok(kind, media_url, book_id, id)));
alter policy member_update on public.member
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));
alter policy progress_insert on public.progress
  with check (((user_id = (select auth.uid())) AND is_couple_member(book_couple_id(book_id))));
alter policy progress_update on public.progress
  using ((user_id = (select auth.uid())))
  with check (((user_id = (select auth.uid())) AND is_couple_member(book_couple_id(book_id))));
alter policy push_sub_own on public.push_sub
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

-- 2. SECURITY DEFINER functions in public were executable by anon (Postgres grants EXECUTE to PUBLIC by default).
revoke execute on all functions in schema public from public, anon;
alter default privileges in schema public revoke execute on functions from public, anon;
grant execute on function
  public.book_couple_id(uuid), public.is_couple_member(uuid), public.my_couple_id(), public.my_max_pos(uuid),
  public.i_answered(uuid, int, text, answer_kind), public.can_use_book_topic(text), public.memory_media_ok(mark_kind, text, uuid, uuid),
  public.create_couple(text, text), public.join_couple(text, text, text), public.set_goal(goal_kind, int)
  to authenticated;

-- 3. Pin search_path (lint 0011).
alter function public.memory_media_ok(mark_kind, text, uuid, uuid) set search_path = public;

-- 4. pg_net out of public (lint 0014). It isn't relocatable; its functions live in schema net either way.
drop extension if exists pg_net;
create extension pg_net with schema extensions;
