alter table public.trip_segments
  add column if not exists transport_kind text,
  add column if not exists company text,
  add column if not exists transport_number text,
  add column if not exists departure_location text,
  add column if not exists departure_address text,
  add column if not exists departure_lat double precision,
  add column if not exists departure_lng double precision,
  add column if not exists arrival_location text,
  add column if not exists arrival_address text,
  add column if not exists arrival_lat double precision,
  add column if not exists arrival_lng double precision,
  add column if not exists reservation_details jsonb not null default '{}'::jsonb,
  add column if not exists image_url text,
  add column if not exists image_urls text[] not null default '{}';

alter table public.trip_segments
  drop constraint if exists trip_segments_transport_kind_check;

alter table public.trip_segments
  add constraint trip_segments_transport_kind_check
  check (
    transport_kind is null
    or transport_kind in (
      'flight', 'car', 'train', 'car_rental', 'transfer', 'cruise',
      'walk', 'bus', 'bike', 'ferry', 'motorcycle'
    )
  );

alter table public.trip_segments
  drop constraint if exists trip_segments_departure_coordinate_pair_check;

alter table public.trip_segments
  add constraint trip_segments_departure_coordinate_pair_check
  check ((departure_lat is null) = (departure_lng is null));

alter table public.trip_segments
  drop constraint if exists trip_segments_arrival_coordinate_pair_check;

alter table public.trip_segments
  add constraint trip_segments_arrival_coordinate_pair_check
  check ((arrival_lat is null) = (arrival_lng is null));

create index if not exists trip_segments_trip_transport_kind_idx
  on public.trip_segments (trip_id, transport_kind)
  where transport_kind is not null;

create table if not exists public.trip_segment_attachments (
  id uuid primary key default gen_random_uuid(),
  segment_id uuid not null references public.trip_segments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('file', 'photo', 'link')),
  display_name varchar(255) not null,
  storage_bucket varchar(100),
  storage_path text,
  external_url text,
  mime_type varchar(255),
  byte_size bigint check (byte_size is null or byte_size >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_segment_attachments_source_check check (
    (
      kind = 'link'
      and external_url is not null
      and storage_bucket is null
      and storage_path is null
    )
    or (
      kind in ('file', 'photo')
      and external_url is null
      and storage_bucket is not null
      and storage_path is not null
    )
  )
);

alter table public.trip_segment_attachments enable row level security;

revoke all on table public.trip_segment_attachments from anon, authenticated;
grant select, insert, update, delete on table public.trip_segment_attachments to authenticated;

drop policy if exists "Trip participants read segment attachments" on public.trip_segment_attachments;
create policy "Trip participants read segment attachments"
  on public.trip_segment_attachments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.trip_segments
      join public.trips on trips.id = trip_segments.trip_id
      where trip_segments.id = trip_segment_attachments.segment_id
        and (
          trips.user_id = (select auth.uid())
          or exists (
            select 1
            from public.trip_collaborators
            where trip_collaborators.trip_id = trips.id
              and trip_collaborators.user_id = (select auth.uid())
              and trip_collaborators.status = 'active'
          )
        )
    )
  );

drop policy if exists "Trip editors insert segment attachments" on public.trip_segment_attachments;
create policy "Trip editors insert segment attachments"
  on public.trip_segment_attachments
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.trip_segments
      join public.trips on trips.id = trip_segments.trip_id
      where trip_segments.id = trip_segment_attachments.segment_id
        and (
          trips.user_id = (select auth.uid())
          or exists (
            select 1
            from public.trip_collaborators
            where trip_collaborators.trip_id = trips.id
              and trip_collaborators.user_id = (select auth.uid())
              and trip_collaborators.status = 'active'
              and trip_collaborators.role in ('owner', 'editor')
          )
        )
    )
  );

drop policy if exists "Trip editors update segment attachments" on public.trip_segment_attachments;
create policy "Trip editors update segment attachments"
  on public.trip_segment_attachments
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.trip_segments
      where trip_segments.id = trip_segment_attachments.segment_id
        and trip_segments.user_id = (select auth.uid())
    )
  )
  with check (user_id = (select auth.uid()));

drop policy if exists "Trip editors delete segment attachments" on public.trip_segment_attachments;
create policy "Trip editors delete segment attachments"
  on public.trip_segment_attachments
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.trip_segments
      where trip_segments.id = trip_segment_attachments.segment_id
        and trip_segments.user_id = (select auth.uid())
    )
  );

drop trigger if exists set_trip_segment_attachments_updated_at on public.trip_segment_attachments;
create trigger set_trip_segment_attachments_updated_at
  before update on public.trip_segment_attachments
  for each row
  execute function public.set_updated_at();

create index if not exists trip_segment_attachments_segment_created_idx
  on public.trip_segment_attachments (segment_id, created_at);

create unique index if not exists trip_segment_attachments_storage_object_unique_idx
  on public.trip_segment_attachments (storage_bucket, storage_path)
  where storage_bucket is not null and storage_path is not null;
