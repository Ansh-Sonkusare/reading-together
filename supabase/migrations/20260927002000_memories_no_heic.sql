-- D23: HEIC/HEIF photos only display in Safari, so the partner on another browser saw a broken image.
-- New uploads take JPEG, PNG or WebP. memory_media_ok keeps accepting .heic/.heif paths so the
-- memories already stored that way can still be edited.
update storage.buckets set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'] where id = 'memories';
