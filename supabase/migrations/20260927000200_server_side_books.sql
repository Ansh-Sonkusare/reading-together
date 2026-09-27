-- D13: books are created only by the server (service role), which computes spine_lengths from the bytes.
drop policy book_insert on book;
alter table book add constraint book_couple_sha256_key unique (couple_id, sha256);
