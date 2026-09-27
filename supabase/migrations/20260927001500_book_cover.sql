-- A book's cover image, extracted from the EPUB by the server at upload: covers/{couple_id}/{book_id}.{ext}.
alter table book add column cover_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

create policy covers_select on storage.objects for select to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = my_couple_id()::text);
create policy covers_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = my_couple_id()::text);
