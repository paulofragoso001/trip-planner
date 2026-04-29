create extension if not exists "pgcrypto";

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text unique,
  is_public boolean not null default false,
  name text not null,
  destination text not null,
  start_date date,
  end_date date,
  status text not null default 'Planning',
  route text,
  budget numeric(12, 2) not null default 0,
  notes text,
  itinerary jsonb not null default '[]'::jsonb,
  documents jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trips
add column if not exists slug text unique;

alter table public.trips
add column if not exists is_public boolean not null default false;

alter table public.trips enable row level security;

drop policy if exists "Users can read their trips" on public.trips;
create policy "Users can read their trips"
  on public.trips for select
  using (auth.uid() = user_id);

drop policy if exists "Public trips readable" on public.trips;
create policy "Public trips readable"
  on public.trips for select
  using (is_public = true);

drop policy if exists "Users can create their trips" on public.trips;
create policy "Users can create their trips"
  on public.trips for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their trips" on public.trips;
create policy "Users can update their trips"
  on public.trips for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their trips" on public.trips;
create policy "Users can delete their trips"
  on public.trips for delete
  using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_trips_updated_at on public.trips;
create trigger set_trips_updated_at
  before update on public.trips
  for each row
  execute function public.set_updated_at();

create index if not exists trips_user_id_created_at_idx
  on public.trips (user_id, created_at desc);
