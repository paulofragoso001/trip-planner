alter table public.trip_segments
add column if not exists flight_number text,
add column if not exists airline text,
add column if not exists departure_airport text,
add column if not exists arrival_airport text,
add column if not exists scheduled_departure timestamptz,
add column if not exists estimated_departure timestamptz,
add column if not exists gate text,
add column if not exists terminal text,
add column if not exists flight_status text,
add column if not exists last_status_checked_at timestamptz;

create index if not exists trip_segments_trip_id_flight_status_idx
  on public.trip_segments (trip_id, flight_status);

create index if not exists trip_segments_flight_number_idx
  on public.trip_segments (flight_number);
