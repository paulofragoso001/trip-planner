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
add column if not exists last_status_checked_at timestamptz,
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

create table if not exists public.trip_segment_comments (
  id uuid primary key default gen_random_uuid(),
  trip_segment_id uuid not null references public.trip_segments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  author_id uuid references auth.users(id) on delete set null,
  author text,
  author_avatar_url text,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.trip_segment_comments enable row level security;

drop policy if exists "Trip segment comments readable by trip access" on public.trip_segment_comments;
create policy "Trip segment comments readable by trip access"
  on public.trip_segment_comments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.trip_segments
      join public.trips on trips.id = trip_segments.trip_id
      where trip_segments.id = trip_segment_comments.trip_segment_id
        and (
          trips.user_id = auth.uid()
          or trips.is_public = true
          or exists (
            select 1
            from public.trip_collaborators
            where trip_collaborators.trip_id = trips.id
              and trip_collaborators.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "Trip segment comments insertable by trip access" on public.trip_segment_comments;
create policy "Trip segment comments insertable by trip access"
  on public.trip_segment_comments
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.trip_segments
      join public.trips on trips.id = trip_segments.trip_id
      where trip_segments.id = trip_segment_comments.trip_segment_id
        and (
          trips.user_id = auth.uid()
          or exists (
            select 1
            from public.trip_collaborators
            where trip_collaborators.trip_id = trips.id
              and trip_collaborators.user_id = auth.uid()
              and trip_collaborators.role in ('owner', 'editor')
          )
        )
    )
  );

create index if not exists trip_segment_comments_segment_created_idx
  on public.trip_segment_comments (trip_segment_id, created_at);

do $$
begin
  if to_regclass('public.flight_truth_events') is not null then
    alter table public.flight_truth_events
      add column if not exists trip_segment_id uuid references public.trip_segments(id) on delete cascade;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'flight_truth_events'
        and column_name = 'itinerary_item_id'
    ) then
      execute 'alter table public.flight_truth_events drop column if exists itinerary_item_id';
    end if;

    create index if not exists flight_truth_events_segment_created_idx
      on public.flight_truth_events (trip_segment_id, created_at desc);
  end if;
end $$;

alter table public.unfiled_items
  drop column if exists promoted_itinerary_item_id;

create index if not exists trip_segments_trip_id_flight_status_idx
  on public.trip_segments (trip_id, flight_status);

create index if not exists trip_segments_flight_number_idx
  on public.trip_segments (flight_number);
