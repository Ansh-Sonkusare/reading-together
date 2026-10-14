-- Front matter (D18: a spine before the book's first TOC entry) is no chapter, so it
-- doesn't count toward today's chapters or the chapter goal. A book with toc null
-- keeps counting every spine, matching chapterTitle in src/features/together/discussion.ts.
create or replace function day_totals(uid uuid, d date) returns table (pages int, chapters int)
language sql stable set search_path = public as $$
  select
    (select coalesce(sum(pos_chars(r.to_max_pos, b.spine_lengths) - pos_chars(r.from_max_pos, b.spine_lengths)), 0)::int / 1500
       from reading_day r join book b on b.id = r.book_id
       where r.user_id = uid and r.day = d),
    (select count(*)::int from event e
       join member m on m.user_id = e.actor_id
       join book b on b.id = e.book_id
       where e.actor_id = uid and e.type = 'chapter_finished'
         and (e.created_at at time zone m.timezone)::date = d
         and (b.toc is null or exists (
           select 1 from jsonb_array_elements(b.toc) t where (t ->> 'spine')::int <= (e.data ->> 'spine')::int)))
$$;
