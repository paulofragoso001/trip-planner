drop policy if exists "Trip collaborators read linked social imports"
  on public.imported_social_posts;
create policy "Trip collaborators read linked social imports"
  on public.imported_social_posts
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or (
      trip_id is not null
      and exists (
        select 1
        from public.trip_collaborators
        where trip_collaborators.trip_id = imported_social_posts.trip_id
          and trip_collaborators.user_id = auth.uid()
          and trip_collaborators.status = 'active'
      )
    )
    or (
      trip_id is not null
      and exists (
        select 1
        from public.trips
        where trips.id = imported_social_posts.trip_id
          and trips.user_id = auth.uid()
      )
    )
  );

drop policy if exists "Trip collaborators read linked extracted places"
  on public.extracted_places;
create policy "Trip collaborators read linked extracted places"
  on public.extracted_places
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or (
      trip_id is not null
      and exists (
        select 1
        from public.trip_collaborators
        where trip_collaborators.trip_id = extracted_places.trip_id
          and trip_collaborators.user_id = auth.uid()
          and trip_collaborators.status = 'active'
      )
    )
    or (
      trip_id is not null
      and exists (
        select 1
        from public.trips
        where trips.id = extracted_places.trip_id
          and trips.user_id = auth.uid()
      )
    )
  );
