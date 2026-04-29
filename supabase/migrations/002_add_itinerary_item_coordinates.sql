create table if not exists public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  location text,
  date_time timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.itinerary_items
add column if not exists lat double precision,
add column if not exists lng double precision,
add column if not exists position integer,
add column if not exists image_url text,
add column if not exists image_urls text[];

create table if not exists public.itinerary_comments (
  id uuid primary key default gen_random_uuid(),
  itinerary_item_id uuid references public.itinerary_items(id) on delete cascade,
  user_id uuid,
  author_id uuid references auth.users(id) on delete set null,
  author text,
  author_avatar_url text,
  content text,
  created_at timestamp default now()
);

alter table public.itinerary_comments
add column if not exists user_id uuid,
add column if not exists author_id uuid references auth.users(id) on delete set null,
add column if not exists author_avatar_url text;

alter table public.itinerary_comments enable row level security;

drop policy if exists "Comments readable for public trips" on public.itinerary_comments;
create policy "Comments readable for public trips"
  on public.itinerary_comments for select
  using (
    exists (
      select 1
      from public.itinerary_items
      join public.trips on trips.id = itinerary_items.trip_id
      where itinerary_items.id = itinerary_comments.itinerary_item_id
        and trips.is_public = true
    )
  );

drop policy if exists "Comments insertable for public trips" on public.itinerary_comments;
create policy "Comments insertable for public trips"
  on public.itinerary_comments for insert
  with check (
    exists (
      select 1
      from public.itinerary_items
      join public.trips on trips.id = itinerary_items.trip_id
      where itinerary_items.id = itinerary_comments.itinerary_item_id
        and trips.is_public = true
    )
  );

update public.itinerary_items
set position = extract(epoch from now())::int
where position is null;

alter table public.itinerary_items enable row level security;

drop policy if exists "Users can read their itinerary items" on public.itinerary_items;
create policy "Users can read their itinerary items"
  on public.itinerary_items for select
  using (auth.uid() = user_id);

drop policy if exists "Public itinerary readable" on public.itinerary_items;
create policy "Public itinerary readable"
  on public.itinerary_items for select
  using (
    exists (
      select 1
      from public.trips
      where trips.id = itinerary_items.trip_id
        and trips.is_public = true
    )
  );

drop policy if exists "Users can create their itinerary items" on public.itinerary_items;
create policy "Users can create their itinerary items"
  on public.itinerary_items for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their itinerary items" on public.itinerary_items;
create policy "Users can update their itinerary items"
  on public.itinerary_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their itinerary items" on public.itinerary_items;
create policy "Users can delete their itinerary items"
  on public.itinerary_items for delete
  using (auth.uid() = user_id);

drop trigger if exists set_itinerary_items_updated_at on public.itinerary_items;
create trigger set_itinerary_items_updated_at
  before update on public.itinerary_items
  for each row
  execute function public.set_updated_at();

create index if not exists itinerary_items_trip_id_date_time_idx
  on public.itinerary_items (trip_id, date_time);

create index if not exists itinerary_items_user_id_trip_id_idx
  on public.itinerary_items (user_id, trip_id);
