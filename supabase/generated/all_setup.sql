
-- supabase/migrations/001_create_trips.sql
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

-- supabase/migrations/002_add_itinerary_item_coordinates.sql
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
  author_id uuid references auth.users(id) on delete set null,
  author text,
  author_avatar_url text,
  content text,
  created_at timestamp default now(),
  user_id uuid
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

-- supabase/migrations/003_create_trip_images_bucket.sql
insert into storage.buckets (id, name, public)
values ('trip-images', 'trip-images', true)
on conflict (id) do update
set public = true;

drop policy if exists "Trip images publicly readable" on storage.objects;
create policy "Trip images publicly readable"
  on storage.objects for select
  using (bucket_id = 'trip-images');

drop policy if exists "Authenticated users can upload trip images" on storage.objects;
create policy "Authenticated users can upload trip images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'trip-images');

-- supabase/migrations/004_create_profiles.sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  avatar_url text,
  created_at timestamp default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are publicly readable" on public.profiles;
create policy "Profiles are publicly readable"
  on public.profiles for select
  using (true);

drop policy if exists "Users can create their profile" on public.profiles;
create policy "Users can create their profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'itinerary_comments_user_id_fkey'
  ) then
    alter table public.itinerary_comments
    add constraint itinerary_comments_user_id_fkey
    foreign key (user_id)
    references public.profiles(id)
    on delete set null;
  end if;
end;
$$;

-- supabase/migrations/005_create_avatars_bucket.sql
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update
set public = true;

drop policy if exists "Avatars publicly readable" on storage.objects;
create policy "Avatars publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Authenticated users can upload avatars" on storage.objects;
create policy "Authenticated users can upload avatars"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars');

-- supabase/migrations/006_create_notifications.sql
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type text,
  content text,
  itinerary_item_id uuid references public.itinerary_items(id) on delete cascade,
  is_read boolean default false,
  created_at timestamp default now()
);

alter table public.notifications enable row level security;

drop policy if exists "Users can read own notifications" on public.notifications;
drop policy if exists "Users see own notifications" on public.notifications;
create policy "Users see own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can create notifications" on public.notifications;
create policy "Authenticated users can create notifications"
  on public.notifications for insert
  to authenticated
  with check (auth.uid() is not null);

-- supabase/migrations/007_create_notification_preferences.sql
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_comments boolean default true,
  inapp_comments boolean default true,
  email_mentions boolean default true,
  inapp_mentions boolean default true,
  created_at timestamp default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "Users can read own notification preferences" on public.notification_preferences;
drop policy if exists "Users can update own notification preferences" on public.notification_preferences;
drop policy if exists "Users can create own notification preferences" on public.notification_preferences;
drop policy if exists "Users manage own preferences" on public.notification_preferences;
create policy "Users manage own preferences"
  on public.notification_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.create_notification_preferences()
returns trigger
language plpgsql
as $$
begin
  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_user_created_preferences on auth.users;
create trigger on_user_created_preferences
  after insert on auth.users
  for each row
  execute procedure public.create_notification_preferences();

-- supabase/migrations/008_add_itinerary_segment_fields.sql
alter table public.itinerary_items
add column if not exists segment_type text default 'activity',
add column if not exists provider text,
add column if not exists confirmation_code text,
add column if not exists booking_url text;

create index if not exists itinerary_items_trip_id_segment_type_idx
  on public.itinerary_items (trip_id, segment_type);
