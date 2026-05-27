alter table public.trips
add column if not exists name text,
add column if not exists destination text,
add column if not exists status text not null default 'Planning',
add column if not exists budget numeric(12, 2) not null default 0,
add column if not exists notes text,
add column if not exists route text,
add column if not exists slug text,
add column if not exists is_public boolean not null default false,
add column if not exists created_at timestamptz not null default now(),
add column if not exists updated_at timestamptz not null default now();

update public.trips
set name = coalesce(name, title, 'Untitled trip'),
    destination = coalesce(destination, 'Destination not set'),
    updated_at = now()
where name is null
   or destination is null;

alter table public.trips
alter column name set not null,
alter column destination set not null;

create unique index if not exists trips_slug_unique_idx
  on public.trips (slug)
  where slug is not null;

drop trigger if exists set_trips_updated_at on public.trips;
create trigger set_trips_updated_at
  before update on public.trips
  for each row
  execute function public.set_updated_at();
