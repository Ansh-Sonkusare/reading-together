create type mark_kind as enum ('highlight', 'reaction', 'note', 'reply', 'bookmark', 'send', 'memory');
create type reaction as enum ('love', 'funny', 'emotional', 'surprised', 'interesting', 'favorite', 'think');
create type event_type as enum ('book_added', 'book_started', 'mark_created', 'chapter_finished', 'book_finished', 'answer_revealed', 'goal_met');
create type answer_kind as enum ('question', 'guess');

create table couple (
  id uuid primary key default gen_random_uuid(),
  invite_code text unique not null default substr(md5(gen_random_uuid()::text), 1, 10),
  created_at timestamptz not null default now()
);

create table member (
  user_id uuid primary key references auth.users on delete cascade,
  couple_id uuid not null references couple on delete cascade,
  name text,
  color text,
  avatar_url text
);
create index on member (couple_id);

create table book (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couple on delete cascade,
  title text not null,
  author text,
  sha256 text,
  storage_path text,
  spine_lengths int[] not null,
  added_by uuid not null default auth.uid() references auth.users,
  created_at timestamptz not null default now()
);
create index on book (couple_id);

create table progress (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  book_id uuid not null references book on delete cascade,
  pos numeric not null default 0,
  max_pos numeric not null default 0,
  locator jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create table mark (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references book on delete cascade,
  author_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind mark_kind not null,
  pos numeric not null,
  locator jsonb,
  emoji reaction,
  body text,
  label text,
  media_url text,
  parent_id uuid references mark on delete cascade,
  created_at timestamptz not null default now()
);
create index on mark (book_id, pos);

create table answer (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references book on delete cascade,
  spine int not null,
  kind answer_kind not null,
  prompt_key text not null,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  value text not null,
  created_at timestamptz not null default now(),
  unique (book_id, spine, prompt_key, user_id)
);

create table event (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couple on delete cascade,
  book_id uuid references book on delete cascade,
  actor_id uuid not null references auth.users on delete cascade,
  type event_type not null,
  ref_id uuid,
  pos numeric,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on event (couple_id, created_at);

create table push_sub (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null,
  keys jsonb not null,
  primary key (user_id, endpoint)
);

-- Helpers. Security definer so policies can call them without recursing through RLS.

create function is_couple_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from member where user_id = auth.uid() and couple_id = cid)
$$;

create function my_couple_id() returns uuid
language sql stable security definer set search_path = public as $$
  select couple_id from member where user_id = auth.uid()
$$;

create function my_max_pos(bid uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select max_pos from progress where user_id = auth.uid() and book_id = bid), 0)
$$;

create function book_couple_id(bid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select couple_id from book where id = bid
$$;

create function i_answered(bid uuid, s int, key text, k answer_kind) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from answer
    where book_id = bid and spine = s and prompt_key = key and kind = k and user_id = auth.uid()
  )
$$;

-- Couple membership: clients go through these RPCs, never insert couple/member directly.

create function enforce_two_members() returns trigger
language plpgsql set search_path = public as $$
begin
  perform 1 from couple where id = new.couple_id for update;
  if (select count(*) from member where couple_id = new.couple_id) >= 2 then
    raise exception 'couple is full' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger member_max_two before insert on member
  for each row execute function enforce_two_members();

create function create_couple(name text, color text) returns text
language plpgsql security definer set search_path = public as $$
declare
  c couple;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into couple default values returning * into c;
  insert into member (user_id, couple_id, name, color) values (auth.uid(), c.id, create_couple.name, create_couple.color);
  return c.invite_code;
end $$;

create function join_couple(invite_code text, name text default null, color text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select id into cid from couple where couple.invite_code = join_couple.invite_code;
  if cid is null then raise exception 'invalid invite code'; end if;
  insert into member (user_id, couple_id, name, color) values (auth.uid(), cid, join_couple.name, join_couple.color);
  return cid;
end $$;

revoke execute on function create_couple(text, text), join_couple(text, text, text) from public, anon;

-- Progress: max_pos is a high-water mark.

create function progress_high_water() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.max_pos := greatest(old.max_pos, new.max_pos);
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger progress_high_water before insert or update on progress
  for each row execute function progress_high_water();

-- Event triggers (the only writers of event).

create function event_on_book() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into event (couple_id, book_id, actor_id, type, ref_id)
  values (new.couple_id, new.id, new.added_by, 'book_added', new.id);
  return null;
end $$;

create trigger book_event after insert on book
  for each row execute function event_on_book();

create function event_on_progress() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
  spines int;
  old_max numeric := case when tg_op = 'INSERT' then 0 else old.max_pos end;
begin
  select couple_id, coalesce(array_length(spine_lengths, 1), 0) into cid, spines from book where id = new.book_id;
  if tg_op = 'INSERT' then
    insert into event (couple_id, book_id, actor_id, type) values (cid, new.book_id, new.user_id, 'book_started');
  end if;
  insert into event (couple_id, book_id, actor_id, type, data)
  select cid, new.book_id, new.user_id, 'chapter_finished', jsonb_build_object('spine', n)
  from generate_series(floor(old_max)::int, least(floor(new.max_pos)::int, spines) - 1) n;
  if new.max_pos >= spines and old_max < spines then
    insert into event (couple_id, book_id, actor_id, type) values (cid, new.book_id, new.user_id, 'book_finished');
  end if;
  return null;
end $$;

create trigger progress_event after insert or update on progress
  for each row execute function event_on_progress();

create function event_on_mark() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into event (couple_id, book_id, actor_id, type, ref_id, pos)
  values (book_couple_id(new.book_id), new.book_id, new.author_id, 'mark_created', new.id, new.pos);
  return null;
end $$;

create trigger mark_event after insert on mark
  for each row execute function event_on_mark();

create function event_on_answer() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from answer
    where book_id = new.book_id and spine = new.spine and prompt_key = new.prompt_key
      and kind = new.kind and user_id <> new.user_id
  ) then
    insert into event (couple_id, book_id, actor_id, type, ref_id, data)
    values (book_couple_id(new.book_id), new.book_id, new.user_id, 'answer_revealed', new.id,
            jsonb_build_object('spine', new.spine, 'prompt_key', new.prompt_key, 'kind', new.kind));
  end if;
  return null;
end $$;

create trigger answer_event after insert on answer
  for each row execute function event_on_answer();

-- RLS

alter table couple enable row level security;
alter table member enable row level security;
alter table book enable row level security;
alter table progress enable row level security;
alter table mark enable row level security;
alter table answer enable row level security;
alter table event enable row level security;
alter table push_sub enable row level security;

create policy couple_select on couple for select to authenticated using (is_couple_member(id));

create policy member_select on member for select to authenticated using (is_couple_member(couple_id));
create policy member_update on member for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on member from anon, authenticated;
grant update (name, color, avatar_url) on member to authenticated;

create policy book_select on book for select to authenticated using (is_couple_member(couple_id));
create policy book_insert on book for insert to authenticated
  with check (is_couple_member(couple_id) and added_by = auth.uid());

create policy progress_select on progress for select to authenticated
  using (is_couple_member(book_couple_id(book_id)));
create policy progress_insert on progress for insert to authenticated
  with check (user_id = auth.uid() and is_couple_member(book_couple_id(book_id)));
create policy progress_update on progress for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and is_couple_member(book_couple_id(book_id)));

create policy mark_select on mark for select to authenticated
  using (is_couple_member(book_couple_id(book_id)) and (author_id = auth.uid() or pos <= my_max_pos(book_id)));
create policy mark_insert on mark for insert to authenticated
  with check (
    author_id = auth.uid()
    and is_couple_member(book_couple_id(book_id))
    and pos <= my_max_pos(book_id) + 1e-9
    and (parent_id is null or exists (select 1 from mark p where p.id = parent_id and p.book_id = mark.book_id))
  );
create policy mark_update on mark for update to authenticated
  using (author_id = auth.uid())
  with check (
    author_id = auth.uid()
    and is_couple_member(book_couple_id(book_id))
    and pos <= my_max_pos(book_id) + 1e-9
  );
create policy mark_delete on mark for delete to authenticated using (author_id = auth.uid());

create policy answer_select on answer for select to authenticated
  using (
    user_id = auth.uid()
    or (is_couple_member(book_couple_id(book_id)) and i_answered(book_id, spine, prompt_key, kind))
  );
create policy answer_insert on answer for insert to authenticated
  with check (user_id = auth.uid() and is_couple_member(book_couple_id(book_id)));

create policy event_select on event for select to authenticated
  using (is_couple_member(couple_id) and (pos is null or actor_id = auth.uid() or pos <= my_max_pos(book_id)));

create policy push_sub_own on push_sub for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
