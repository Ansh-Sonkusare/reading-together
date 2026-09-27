-- P31: reading days, streaks and couple reading goals.

create function is_timezone(tz text) returns boolean
language sql stable set search_path = public as $$
  select exists (select 1 from pg_timezone_names where name = tz)
$$;

alter table member add column timezone text not null default 'UTC' check (is_timezone(timezone));
grant update (timezone) on member to authenticated;

-- Chars before pos, the numerator of displayPage (src/features/reader/locator.ts).
create function pos_chars(pos numeric, spine_lengths int[]) returns int
language sql immutable set search_path = public as $$
  select ((select coalesce(sum(l), 0) from unnest(spine_lengths[1:s]) l)
          + least(spine_lengths[s + 1], round((pos - s) * spine_lengths[s + 1])))::int
  from (select least(floor(pos)::int, cardinality(spine_lengths) - 1) as s) x
$$;

create or replace function display_page(pos numeric, spine_lengths int[]) returns int
language sql immutable set search_path = public as $$
  select pos_chars(pos, spine_lengths) / 1500 + 1
$$;

create table reading_day (
  user_id uuid not null references auth.users on delete cascade,
  book_id uuid not null references book on delete cascade,
  day date not null,
  from_max_pos numeric not null,
  to_max_pos numeric not null,
  primary key (user_id, book_id, day),
  check (to_max_pos > from_max_pos)
);

alter table reading_day enable row level security;
create policy reading_day_select on reading_day for select to authenticated
  using (is_couple_member(book_couple_id(book_id)));

create type goal_kind as enum ('pages_per_day', 'chapters_per_day');

create table goal (
  couple_id uuid primary key references couple on delete cascade,
  kind goal_kind not null,
  target int not null check (target > 0),
  updated_by uuid not null references auth.users on delete cascade,
  updated_at timestamptz not null default now()
);

alter table goal enable row level security;
create policy goal_select on goal for select to authenticated using (is_couple_member(couple_id));

create function set_goal(kind goal_kind, target int) returns void
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := my_couple_id();
begin
  if cid is null then
    raise exception 'not in a couple';
  end if;
  insert into goal (couple_id, kind, target, updated_by)
  values (cid, set_goal.kind, set_goal.target, auth.uid())
  on conflict (couple_id) do update
    set kind = excluded.kind, target = excluded.target, updated_by = excluded.updated_by, updated_at = now();
end $$;

revoke execute on function set_goal(goal_kind, int) from public, anon;
grant execute on function set_goal(goal_kind, int) to authenticated;

-- pages: chars read that day across all books / 1500 (displayPage's page size).
-- chapters: chapter_finished events in the member's local day.
create function day_totals(uid uuid, d date) returns table (pages int, chapters int)
language sql stable set search_path = public as $$
  select
    (select coalesce(sum(pos_chars(r.to_max_pos, b.spine_lengths) - pos_chars(r.from_max_pos, b.spine_lengths)), 0)::int / 1500
       from reading_day r join book b on b.id = r.book_id
       where r.user_id = uid and r.day = d),
    (select count(*)::int from event e join member m on m.user_id = e.actor_id
       where e.actor_id = uid and e.type = 'chapter_finished'
         and (e.created_at at time zone m.timezone)::date = d)
$$;

create unique index event_goal_met_once on event (actor_id, (data ->> 'day')) where type = 'goal_met';

-- Named after progress_event so it fires after it: chapter_finished rows for this
-- update already exist when the chapter goal is checked.
create function reading_day_on_progress() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  old_max numeric := case when tg_op = 'INSERT' then 0 else old.max_pos end;
  m member;
  g goal;
  d date;
  done int;
begin
  if new.max_pos <= old_max then
    return null;
  end if;
  select * into m from member where user_id = new.user_id;
  if not found then
    return null;
  end if;
  d := (now() at time zone m.timezone)::date;
  insert into reading_day (user_id, book_id, day, from_max_pos, to_max_pos)
  values (new.user_id, new.book_id, d, old_max, new.max_pos)
  on conflict (user_id, book_id, day) do update set to_max_pos = excluded.to_max_pos;

  select * into g from goal where couple_id = m.couple_id;
  if not found then
    return null;
  end if;
  select case g.kind when 'pages_per_day' then t.pages else t.chapters end into done
  from day_totals(new.user_id, d) t;
  if done >= g.target then
    insert into event (couple_id, actor_id, type, data)
    values (m.couple_id, new.user_id, 'goal_met', jsonb_build_object('day', d, 'kind', g.kind, 'target', g.target))
    on conflict (actor_id, (data ->> 'day')) where type = 'goal_met' do nothing;
  end if;
  return null;
end $$;

create trigger progress_reading_day after insert or update on progress
  for each row execute function reading_day_on_progress();

-- Each member's own local today, with that day's totals. RLS applies (security_invoker).
create view reading_today with (security_invoker = true) as
select m.user_id, m.couple_id, d.day, t.pages, t.chapters
from member m
cross join lateral (select (now() at time zone m.timezone)::date as day) d
cross join lateral day_totals(m.user_id, d.day) t;

revoke all on reading_today from anon;
grant select on reading_today to authenticated;
