alter table public.itinerary_items
add column if not exists segment_type text default 'activity',
add column if not exists provider text,
add column if not exists confirmation_code text,
add column if not exists booking_url text;

create index if not exists itinerary_items_trip_id_segment_type_idx
  on public.itinerary_items (trip_id, segment_type);
