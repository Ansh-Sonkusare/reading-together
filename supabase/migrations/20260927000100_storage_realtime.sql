insert into storage.buckets (id, name, public) values ('books', 'books', false);

create policy books_select on storage.objects for select to authenticated
  using (bucket_id = 'books' and (storage.foldername(name))[1] = my_couple_id()::text);
create policy books_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'books' and (storage.foldername(name))[1] = my_couple_id()::text);

alter publication supabase_realtime add table mark, progress, event;
