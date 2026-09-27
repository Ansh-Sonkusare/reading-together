-- F1: private Realtime broadcast/presence topics `<feature>:<bookId>` are open only to the book's couple.
-- Add a feature by extending the prefix alternation. Anything that doesn't match is denied.

create function can_use_book_topic(topic text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when topic ~ '^(sync):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then is_couple_member(book_couple_id(split_part(topic, ':', 2)::uuid))
    else false
  end
$$;

revoke execute on function can_use_book_topic(text) from public, anon;
grant execute on function can_use_book_topic(text) to authenticated;

create policy book_topic_receive on realtime.messages for select to authenticated
  using (extension in ('broadcast', 'presence') and public.can_use_book_topic((select realtime.topic())));

create policy book_topic_send on realtime.messages for insert to authenticated
  with check (extension in ('broadcast', 'presence') and public.can_use_book_topic((select realtime.topic())));
