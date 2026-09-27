-- Two partners answering at the same moment each missed the other's uncommitted row,
-- so no answer_revealed was written. Serialise per prompt; the second trigger then sees the first commit.
create or replace function event_on_answer() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.book_id::text || ':' || new.spine || ':' || new.prompt_key || ':' || new.kind));
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
