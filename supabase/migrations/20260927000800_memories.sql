insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memories', 'memories', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

create policy memories_select on storage.objects for select to authenticated
  using (bucket_id = 'memories' and (storage.foldername(name))[1] = my_couple_id()::text);
create policy memories_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'memories' and (storage.foldername(name))[1] = my_couple_id()::text);
-- The uploader removes its photo when the mark insert that should reference it fails.
create policy memories_delete on storage.objects for delete to authenticated
  using (bucket_id = 'memories' and owner_id = auth.uid()::text);

-- A memory's photo lives at {couple_id}/{mark_id}.{ext} in the memories bucket; no other kind carries media.
create function memory_media_ok(kind mark_kind, media_url text, book_id uuid, id uuid) returns boolean
language sql stable as $$
  select case when kind = 'memory'
    then media_url ~ ('^' || book_couple_id(book_id) || '/' || id || '\.(jpg|jpeg|png|webp|heic|heif)$')
    else media_url is null end
$$;

drop policy mark_insert on mark;
create policy mark_insert on mark for insert to authenticated
  with check (
    author_id = auth.uid()
    and is_couple_member(book_couple_id(book_id))
    and pos <= my_max_pos(book_id) + 1e-9
    and (parent_id is null or exists (select 1 from mark p where p.id = mark.parent_id and p.book_id = mark.book_id))
    and memory_media_ok(kind, media_url, book_id, id)
  );

drop policy mark_update on mark;
create policy mark_update on mark for update to authenticated
  using (author_id = auth.uid())
  with check (
    author_id = auth.uid()
    and is_couple_member(book_couple_id(book_id))
    and pos <= my_max_pos(book_id) + 1e-9
    and memory_media_ok(kind, media_url, book_id, id)
  );
