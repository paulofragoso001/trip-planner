alter table public.trip_segments
add column if not exists lat double precision,
add column if not exists lng double precision,
add column if not exists notes text,
add column if not exists provider text,
add column if not exists confirmation_code text,
add column if not exists booking_url text,
add column if not exists position integer,
add column if not exists updated_at timestamptz not null default now();

drop trigger if exists set_trip_segments_updated_at on public.trip_segments;
create trigger set_trip_segments_updated_at
  before update on public.trip_segments
  for each row
  execute function public.set_updated_at();

create index if not exists trip_segments_trip_id_position_idx
  on public.trip_segments (trip_id, position);

create index if not exists trip_segments_trip_id_lat_lng_idx
  on public.trip_segments (trip_id, lat, lng)
  where lat is not null and lng is not null;
