-- Six partner inks (docs/design.md). Same order as src/features/couple/palette.ts.
create function inks() returns text[]
language sql immutable set search_path = public as $$
  select array['#d6336c', '#3b5bdb', '#0ca678', '#e8890c', '#7048e8', '#1098ad']
$$;

-- Closest ink by RGB distance, skipping `taken`. A null or non-hex `want` gets the first free ink.
create function nearest_ink(want text, taken text[] default '{}') returns text
language sql immutable set search_path = public as $$
  select ink from unnest(inks()) with ordinality as i(ink, n)
  where ink <> all(coalesce(taken, '{}'))
  order by case when want ~* '^#[0-9a-f]{6}$' then
      power(('x' || substr(want, 2, 2))::bit(8)::int - ('x' || substr(ink, 2, 2))::bit(8)::int, 2)
    + power(('x' || substr(want, 4, 2))::bit(8)::int - ('x' || substr(ink, 4, 2))::bit(8)::int, 2)
    + power(('x' || substr(want, 6, 2))::bit(8)::int - ('x' || substr(ink, 6, 2))::bit(8)::int, 2)
  else 0 end, n
  limit 1
$$;

do $$
declare
  m record;
begin
  for m in select user_id, couple_id, color from member order by couple_id, color is null, user_id loop
    update member set color = nearest_ink(m.color, array(
      select p.color from member p where p.couple_id = m.couple_id and p.user_id <> m.user_id and p.color is not null))
    where user_id = m.user_id;
  end loop;
end $$;

-- A check rather than NOT NULL keeps member's generated Insert type unchanged for existing callers.
alter table member
  add constraint member_color_is_ink check (color is not null and color = any(inks())),
  add constraint member_couple_color_key unique (couple_id, color);

create or replace function create_couple(name text, color text) returns text
language plpgsql security definer set search_path = public as $$
declare
  c couple;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into couple default values returning * into c;
  insert into member (user_id, couple_id, name, color) values (auth.uid(), c.id, create_couple.name, nearest_ink(create_couple.color));
  return c.invite_code;
end $$;

create or replace function join_couple(invite_code text, name text default null, color text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
  taken text[];
  pick text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select id into cid from couple where couple.invite_code = join_couple.invite_code;
  if cid is null then raise exception 'invalid invite code'; end if;
  taken := array(select m.color from member m where m.couple_id = cid);
  if join_couple.color ~* '^#[0-9a-f]{6}$' then
    pick := nearest_ink(join_couple.color);
    -- A full couple falls through to member_max_two's 'couple is full'.
    if pick = any(taken) and cardinality(taken) < 2 then raise exception 'ink taken'; end if;
  else
    pick := nearest_ink(null, taken);
  end if;
  insert into member (user_id, couple_id, name, color) values (auth.uid(), cid, join_couple.name, pick);
  return cid;
end $$;
