alter table public.extracted_places
  drop constraint if exists extracted_places_status_check;

alter table public.extracted_places
  add constraint extracted_places_status_check
  check (status in ('needs_review', 'accepted', 'dismissed', 'promoted', 'merged', 'needs_location_confirmation'));

alter table public.trip_segments
  add column if not exists provider_place_id text,
  add column if not exists source_import_id uuid references public.imported_social_posts(id) on delete set null,
  add column if not exists provider_metadata jsonb not null default '{}'::jsonb,
  add column if not exists location_status text not null default 'unresolved'
    check (location_status in ('resolved', 'unresolved', 'needs_location_confirmation'));

update public.trip_segments
set location_status = 'resolved'
where lat is not null
  and lng is not null
  and location_status <> 'resolved';

create table if not exists public.travel_inventory (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_item_id text,
  type text not null,
  title text not null,
  description text,
  category text,
  price_from numeric,
  currency text,
  rating numeric,
  review_count integer,
  address text,
  latitude double precision,
  longitude double precision,
  image_url text,
  booking_url text,
  availability jsonb,
  duration_minutes integer,
  cancellation_policy text,
  source_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_inventory_type_check
    check (type in ('place', 'activity', 'tour', 'event', 'restaurant', 'hotel', 'flight')),
  constraint travel_inventory_provider_item_unique
    unique (provider, provider_item_id)
);

create unique index if not exists travel_inventory_provider_null_item_unique
  on public.travel_inventory (provider, title, coalesce(address, ''))
  where provider_item_id is null;

create table if not exists public.trip_recommendations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  trip_segment_id uuid references public.trip_segments(id) on delete cascade,
  inventory_id uuid not null references public.travel_inventory(id) on delete cascade,
  recommendation_type text not null,
  reason text,
  score numeric,
  status text not null default 'suggested'
    check (status in ('suggested', 'saved', 'dismissed', 'booked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists trip_recommendations_unique_active_idx
  on public.trip_recommendations (trip_id, coalesce(trip_segment_id, '00000000-0000-0000-0000-000000000000'::uuid), inventory_id)
  where status <> 'dismissed';

alter table public.travel_inventory enable row level security;
alter table public.trip_recommendations enable row level security;

revoke all on table public.travel_inventory from anon, authenticated;
revoke all on table public.trip_recommendations from anon, authenticated;
grant select on table public.travel_inventory to authenticated;
grant select, insert, update, delete on table public.trip_recommendations to authenticated;

drop policy if exists "Authenticated users read travel inventory" on public.travel_inventory;
create policy "Authenticated users read travel inventory"
  on public.travel_inventory
  for select
  to authenticated
  using (true);

drop policy if exists "Trip owners manage recommendations" on public.trip_recommendations;
create policy "Trip owners manage recommendations"
  on public.trip_recommendations
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.trips
      where trips.id = trip_recommendations.trip_id
        and trips.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.trips
      where trips.id = trip_recommendations.trip_id
        and trips.user_id = auth.uid()
    )
  );

drop policy if exists "Trip collaborators read recommendations" on public.trip_recommendations;
create policy "Trip collaborators read recommendations"
  on public.trip_recommendations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.trip_collaborators
      where trip_collaborators.trip_id = trip_recommendations.trip_id
        and trip_collaborators.user_id = auth.uid()
    )
  );

drop trigger if exists set_travel_inventory_updated_at on public.travel_inventory;
create trigger set_travel_inventory_updated_at
  before update on public.travel_inventory
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_trip_recommendations_updated_at on public.trip_recommendations;
create trigger set_trip_recommendations_updated_at
  before update on public.trip_recommendations
  for each row
  execute function public.set_updated_at();

create index if not exists trip_segments_trip_location_status_idx
  on public.trip_segments (trip_id, location_status);

create index if not exists trip_segments_provider_place_id_idx
  on public.trip_segments (provider_place_id)
  where provider_place_id is not null;

create index if not exists travel_inventory_provider_type_idx
  on public.travel_inventory (provider, type);

create index if not exists travel_inventory_location_idx
  on public.travel_inventory (latitude, longitude)
  where latitude is not null and longitude is not null;

create index if not exists trip_recommendations_trip_status_idx
  on public.trip_recommendations (trip_id, status, created_at desc);

create index if not exists trip_recommendations_segment_idx
  on public.trip_recommendations (trip_segment_id)
  where trip_segment_id is not null;
