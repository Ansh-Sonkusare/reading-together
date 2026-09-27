drop policy mark_insert on mark;
create policy mark_insert on mark for insert to authenticated
  with check (
    author_id = auth.uid()
    and is_couple_member(book_couple_id(book_id))
    and pos <= my_max_pos(book_id) + 1e-9
    and (parent_id is null or exists (select 1 from mark p where p.id = mark.parent_id and p.book_id = mark.book_id))
  );
