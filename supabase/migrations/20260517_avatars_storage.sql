-- Avatars: public Storage bucket + per-user write policies + a cleanup
-- column on profiles so we can delete the old object when a user replaces
-- their avatar (otherwise orphans pile up forever).
--
-- Layout: avatars/<auth.uid()>/<timestamp>.webp. Each user is sandboxed
-- to a folder named after their auth uid; the policies below enforce
-- that with storage.foldername(name)[1].

-- ---------------------------------------------------------------- bucket

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- ----------------------------------------------------- storage.objects RLS
-- Drop-and-recreate so re-running the migration is safe.

drop policy if exists "Avatars are publicly readable"   on storage.objects;
drop policy if exists "Users can upload own avatar"     on storage.objects;
drop policy if exists "Users can update own avatar"     on storage.objects;
drop policy if exists "Users can delete own avatar"     on storage.objects;

create policy "Avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ----------------------------------------------------- profiles.avatar_path
-- avatar_url already exists (the public URL we render). avatar_path is the
-- in-bucket key we keep around so we can call storage.remove(...) on it
-- when the user uploads a replacement. Without this we'd leak objects.

alter table profiles add column if not exists avatar_path text;
