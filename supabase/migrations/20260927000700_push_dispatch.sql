-- P33: every notifiable event the partner may see is posted (event id only) to the app's
-- /api/push/dispatch route, which words it and sends Web Push with the service role.
create extension if not exists pg_net;

-- The URL is the local default (the DB container reaches `pnpm dev` on the host); other
-- environments call set_push_dispatch_url. The secret is generated here, so it never exists in a file.
select vault.create_secret('http://host.docker.internal:3000/api/push/dispatch', 'push_dispatch_url');
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'push_dispatch_secret');

create function push_dispatch_secret() returns text
language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'push_dispatch_secret'
$$;

create function set_push_dispatch_url(url text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  previous text;
  sid uuid;
begin
  select id, decrypted_secret into sid, previous from vault.decrypted_secrets where name = 'push_dispatch_url';
  perform vault.update_secret(sid, url);
  return previous;
end $$;

revoke execute on function push_dispatch_secret() from public, anon, authenticated;
revoke execute on function set_push_dispatch_url(text) from public, anon, authenticated;
grant execute on function push_dispatch_secret() to service_role;
grant execute on function set_push_dispatch_url(text) to service_role;

-- The spoiler gate (rule 2) is applied here, before anything leaves the database:
-- a mark ahead of the partner is not posted at all (D9).
create function push_on_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  recipient uuid := (select user_id from member where couple_id = new.couple_id and user_id <> new.actor_id);
begin
  if recipient is null
    or new.type not in ('mark_created', 'chapter_finished', 'book_finished', 'answer_revealed')
    or new.pos > coalesce((select max_pos from progress where user_id = recipient and book_id = new.book_id), 0)
    or not exists (select 1 from push_sub where user_id = recipient)
  then
    return null;
  end if;
  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'push_dispatch_url'),
    body := jsonb_build_object('event_id', new.id),
    headers := jsonb_build_object('content-type', 'application/json', 'x-push-secret', push_dispatch_secret())
  );
  return null;
end $$;

create trigger event_push after insert on event
  for each row execute function push_on_event();
