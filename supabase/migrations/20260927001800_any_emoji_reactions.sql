-- D22: a reaction is any emoji, stored as the character itself. Safe to re-run.

drop view if exists couple_stats;

do $$
begin
  if (select format_type(atttypid, null) from pg_attribute where attrelid = 'public.mark'::regclass and attname = 'emoji') = 'reaction' then
    alter table public.mark alter column emoji type text using case emoji::text
      when 'love' then '❤️' when 'funny' then '😂' when 'emotional' then '😭' when 'surprised' then '😮'
      when 'interesting' then '🤔' when 'favorite' then '🔥' when 'think' then '💭' end;
  end if;
end $$;

drop type if exists reaction;

alter table mark drop constraint if exists mark_emoji_is_reaction;
alter table mark add constraint mark_emoji_is_reaction
  check ((emoji is null) = (kind <> 'reaction') and (emoji is null or (char_length(emoji) between 1 and 16 and btrim(emoji) <> '')));

-- Duplicates of one person's emoji on one passage collapse into the oldest, which takes over any replies.
drop table if exists pg_temp.dup_reaction;
create temp table dup_reaction as
select id, first_value(id) over (partition by book_id, author_id, locator->>'cfi', emoji order by created_at, id) as keep
from mark where kind = 'reaction' and locator->>'cfi' is not null;
update mark m set parent_id = d.keep from dup_reaction d where m.parent_id = d.id and d.id <> d.keep;
delete from mark m using dup_reaction d where m.id = d.id and d.id <> d.keep;
drop table dup_reaction;

create unique index if not exists mark_one_reaction_per_emoji on mark (book_id, author_id, (locator->>'cfi'), emoji) where kind = 'reaction';

-- As in 20260927000400, keyed by the emoji itself.
create view couple_stats with (security_invoker = true) as
select
  c.id as couple_id,
  (select count(*) from book b where b.couple_id = c.id
     and (select count(*) from progress p where p.book_id = b.id) = 2)::int as books_together,
  (select coalesce(sum(display_page(p.max_pos, b.spine_lengths)), 0)
     from progress p join book b on b.id = p.book_id where b.couple_id = c.id)::int as pages,
  (select count(*) from mark m join book b on b.id = m.book_id
     where b.couple_id = c.id and m.kind = 'highlight')::int as highlights,
  (select count(*) from event e where e.couple_id = c.id and e.type = 'answer_revealed')::int as discussions,
  (select coalesce(jsonb_object_agg(r.emoji, r.n), '{}')
     from (select m.emoji, count(*) as n from mark m join book b on b.id = m.book_id
           where b.couple_id = c.id and m.kind = 'reaction' and m.emoji is not null group by m.emoji) r) as reactions
from couple c;

revoke all on couple_stats from anon;
grant select on couple_stats to authenticated;
