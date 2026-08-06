-- Phase 1 keeps avatars public because they are shown on public/collaborative profiles.
-- Public read compatibility is unchanged; only authenticated mutations are tightened.
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
where id = 'avatars';

drop policy if exists "Authenticated users can upload avatars" on storage.objects;
drop policy if exists "Users insert owned avatars" on storage.objects;
drop policy if exists "Users update owned avatars" on storage.objects;
drop policy if exists "Users delete owned avatars" on storage.objects;

create policy "Users insert owned avatars"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and array_length(storage.foldername(name), 1) = 1
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
  );

create policy "Users update owned avatars"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (
    bucket_id = 'avatars'
    and array_length(storage.foldername(name), 1) = 1
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
  );

create policy "Users delete owned avatars"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and array_length(storage.foldername(name), 1) = 1
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Rollback guidance (manual, only if this migration must be reversed): drop the
-- three owned-avatar policies, restore the legacy bucket-scoped INSERT policy,
-- and clear file_size_limit/allowed_mime_types. Keep the public SELECT policy.
