-- F3: the book's own table of contents, [{ spine, label }], computed by the server at upload (D13).
-- Null for books uploaded before this column, and for EPUBs whose TOC points at no spine item.
alter table book add column toc jsonb check (jsonb_typeof(toc) = 'array');
