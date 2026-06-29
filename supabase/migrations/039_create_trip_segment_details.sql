do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'booking_type'
  ) then
    create type public.booking_type as enum (
      'flight',
      'lodging',
      'dining',
      'activity',
      'transit'
    );
  end if;
end $$;

create table if not exists public.trip_segment_details (
  id uuid primary key default gen_random_uuid(),
  segment_id uuid not null unique references public.trip_segments(id) on delete cascade,
  type public.booking_type not null default 'activity',
  location_name varchar(255) not null,
  formatted_address varchar(512),
  confirmation_code varchar(100),
  flight_number varchar(20),
  airline_carrier varchar(100),
  phone_number varchar(40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trip_segment_details enable row level security;

drop policy if exists "Trip participants read segment details" on public.trip_segment_details;
create policy "Trip participants read segment details"
  on public.trip_segment_details
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.trip_segments
      join public.trips on trips.id = trip_segments.trip_id
      where trip_segments.id = trip_segment_details.segment_id
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

drop policy if exists "Trip editors insert segment details" on public.trip_segment_details;
create policy "Trip editors insert segment details"
  on public.trip_segment_details
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.trip_segments
      join public.trips on trips.id = trip_segments.trip_id
      where trip_segments.id = trip_segment_details.segment_id
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

drop policy if exists "Trip editors update segment details" on public.trip_segment_details;
create policy "Trip editors update segment details"
  on public.trip_segment_details
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.trip_segments
      join public.trips on trips.id = trip_segments.trip_id
      where trip_segments.id = trip_segment_details.segment_id
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
  )
  with check (
    exists (
      select 1
      from public.trip_segments
      join public.trips on trips.id = trip_segments.trip_id
      where trip_segments.id = trip_segment_details.segment_id
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

drop policy if exists "Trip editors delete segment details" on public.trip_segment_details;
create policy "Trip editors delete segment details"
  on public.trip_segment_details
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.trip_segments
      join public.trips on trips.id = trip_segments.trip_id
      where trip_segments.id = trip_segment_details.segment_id
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

drop trigger if exists set_trip_segment_details_updated_at on public.trip_segment_details;
create trigger set_trip_segment_details_updated_at
  before update on public.trip_segment_details
  for each row
  execute function public.set_updated_at();

create index if not exists trip_segment_details_segment_id_idx
  on public.trip_segment_details (segment_id);

create index if not exists trip_segment_details_type_idx
  on public.trip_segment_details (type);

create index if not exists trip_segment_details_confirmation_code_idx
  on public.trip_segment_details (confirmation_code)
  where confirmation_code is not null;

create index if not exists trip_segment_details_flight_number_idx
  on public.trip_segment_details (flight_number)
  where flight_number is not null;

revoke all on table public.trip_segment_details from anon, authenticated;
grant select, insert, update, delete on table public.trip_segment_details to authenticated;
