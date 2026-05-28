alter table public.trip_segments
  add column if not exists flight_lat double precision,
  add column if not exists flight_lng double precision,
  add column if not exists flight_altitude double precision,
  add column if not exists flight_bearing double precision,
  add column if not exists flight_speed double precision,
  add column if not exists flight_position_updated_at timestamptz,
  add column if not exists departure_airport_lat double precision,
  add column if not exists departure_airport_lng double precision,
  add column if not exists arrival_airport_lat double precision,
  add column if not exists arrival_airport_lng double precision;

create index if not exists trip_segments_flight_position_idx
  on public.trip_segments (trip_id, flight_lat, flight_lng)
  where flight_lat is not null and flight_lng is not null;
