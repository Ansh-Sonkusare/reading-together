-- Mirrors displayPage in src/features/together/pages.ts: 1-based page at 1500 chars per page.
create function display_page(pos numeric, spine_lengths int[]) returns int
language sql immutable set search_path = public as $$
  select ((select coalesce(sum(l), 0) from unnest(spine_lengths[1:s]) l)
          + least(spine_lengths[s + 1], round((pos - s) * spine_lengths[s + 1])))::int / 1500 + 1
  from (select least(floor(pos)::int, cardinality(spine_lengths) - 1) as s) x
$$;

-- security_invoker: every count goes through the caller's RLS, so a partner's mark
-- ahead of the caller (spoiler gate) is never counted.
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
