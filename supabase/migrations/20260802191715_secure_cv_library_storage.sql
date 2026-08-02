-- Keep CV documents private and place every user's files in their own folder.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'cvs',
  'cvs',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/rtf',
    'text/rtf'
  ]::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "own cv files - read" on storage.objects;
drop policy if exists "own cv files - upload" on storage.objects;
drop policy if exists "own cv files - delete" on storage.objects;
drop policy if exists "Users can read own CV files" on storage.objects;
drop policy if exists "Users can upload own CV files" on storage.objects;
drop policy if exists "Users can update own CV files" on storage.objects;
drop policy if exists "Users can delete own CV files" on storage.objects;

create policy "Users can read own CV files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'cvs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can upload own CV files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'cvs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can update own CV files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'cvs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'cvs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can delete own CV files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'cvs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
