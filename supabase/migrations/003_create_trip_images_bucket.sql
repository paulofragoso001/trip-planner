insert into storage.buckets (id, name, public)
values ('trip-images', 'trip-images', true)
on conflict (id) do update
set public = true;

drop policy if exists "Trip images publicly readable" on storage.objects;
create policy "Trip images publicly readable"
  on storage.objects for select
  using (bucket_id = 'trip-images');

drop policy if exists "Authenticated users can upload trip images" on storage.objects;
create policy "Authenticated users can upload trip images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'trip-images');
