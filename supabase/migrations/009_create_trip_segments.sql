create table if not exists public.trip_segments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  start_time timestamptz,
  end_time timestamptz,
  location text,
  inserted_at timestamptz not null default now()
);

alter table public.trip_segments enable row level security;

drop policy if exists "Users manage own segments" on public.trip_segments;
create policy "Users manage own segments"
  on public.trip_segments
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists trip_segments_trip_id_start_time_idx
  on public.trip_segments (trip_id, start_time asc);

create index if not exists trip_segments_user_id_idx
  on public.trip_segments (user_id);
