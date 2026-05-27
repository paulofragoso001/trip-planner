create table if not exists public.flight_truth_events (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  itinerary_item_id uuid not null references public.itinerary_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  message text not null,
  previous_value text,
  next_value text,
  provider text not null default 'cirium',
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists flight_truth_events_trip_created_idx
  on public.flight_truth_events (trip_id, created_at desc);

create index if not exists flight_truth_events_item_created_idx
  on public.flight_truth_events (itinerary_item_id, created_at desc);

create index if not exists flight_truth_events_user_created_idx
  on public.flight_truth_events (user_id, created_at desc);

alter table public.flight_truth_events enable row level security;

drop policy if exists "Users can read their flight truth events" on public.flight_truth_events;
create policy "Users can read their flight truth events"
  on public.flight_truth_events for select
  using (auth.uid() = user_id);
