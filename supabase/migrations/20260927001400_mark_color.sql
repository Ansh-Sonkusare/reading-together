-- Each highlight, note and bookmark can carry its own ink (docs/design.md, "Colour means a person").
-- Null means the author's member ink, so every existing mark keeps rendering as before.
alter table mark
  add column color text,
  add constraint mark_color_is_ink check (color is null or (color = any(inks()) and kind in ('highlight', 'note', 'bookmark')));

-- Nothing you make can pass for your partner's: a mark never takes the ink of another member of the book's couple.
create function mark_color_not_partners() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.color is not null and exists (
    select 1 from member p join book b on b.couple_id = p.couple_id
    where b.id = new.book_id and p.user_id <> new.author_id and p.color = new.color
  ) then
    raise exception 'that ink is your partner''s' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger mark_color_not_partners before insert or update of color, author_id, book_id on mark
  for each row execute function mark_color_not_partners();
