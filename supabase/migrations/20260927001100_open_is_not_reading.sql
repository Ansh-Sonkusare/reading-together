-- Opening a book writes the first progress row; that isn't reading yet. A reading day starts with the first page turned.
create or replace function reading_day_on_progress() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  old_max numeric := case when tg_op = 'INSERT' then new.max_pos else old.max_pos end;
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

