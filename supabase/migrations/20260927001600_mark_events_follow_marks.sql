-- A removed mark takes its mark_created event with it, so the timeline, memory count and pushes
-- never describe a mark that no longer exists. Replies deleted by the parent's cascade go the same way.
create function event_on_mark_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from event where type = 'mark_created' and ref_id = old.id;
  return null;
end $$;

revoke execute on function event_on_mark_delete() from public, anon, authenticated;

create trigger mark_event_delete after delete on mark
  for each row execute function event_on_mark_delete();
