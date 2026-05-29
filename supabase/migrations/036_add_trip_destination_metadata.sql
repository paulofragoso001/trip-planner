alter table public.trips
  add column if not exists destination_status text not null default 'manual'
    check (destination_status in ('manual', 'resolved', 'unresolved')),
  add column if not exists destination_place_id text,
  add column if not exists destination_formatted_address text,
  add column if not exists destination_lat double precision,
  add column if not exists destination_lng double precision,
  add column if not exists destination_provider_metadata jsonb not null default '{}'::jsonb;

update public.trips
set destination_status = 'manual'
where destination_status is null;

create index if not exists trips_destination_place_id_idx
  on public.trips (destination_place_id)
  where destination_place_id is not null;

create index if not exists trips_destination_status_idx
  on public.trips (destination_status);
