create table if not exists public.imported_social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,

  source_platform text not null default 'manual'
    check (source_platform in ('instagram', 'tiktok', 'youtube', 'pinterest', 'manual', 'screenshot', 'other')),
  source_url text,
  source_title text,
  source_author text,
  source_caption text,

  uploaded_asset_path text,
  thumbnail_path text,

  status text not null default 'pending'
    check (status in ('pending', 'processing', 'needs_review', 'processed', 'failed', 'dismissed')),
  parser_version text not null default 'social-import-v1',
  raw_text text,
  raw_metadata jsonb not null default '{}'::jsonb,
  error_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.extracted_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  imported_post_id uuid not null references public.imported_social_posts(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  promoted_trip_segment_id uuid references public.trip_segments(id) on delete set null,

  name text not null,
  normalized_name text,
  category text not null default 'activity',
  description text,
  travel_note text,

  address text,
  city text,
  region text,
  country text,
  place_id text,
  latitude double precision,
  longitude double precision,

  confidence numeric(4, 3) not null default 0,
  priority text not null default 'candidate'
    check (priority in ('must_do', 'want_to_do', 'optional', 'candidate')),

  dedupe_key text,
  duplicate_of uuid references public.extracted_places(id) on delete set null,

  status text not null default 'needs_review'
    check (status in ('needs_review', 'accepted', 'dismissed', 'promoted', 'merged')),

  evidence jsonb not null default '[]'::jsonb,
  ai_payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.imported_social_posts enable row level security;
alter table public.extracted_places enable row level security;

revoke all on table public.imported_social_posts from anon, authenticated;
revoke all on table public.extracted_places from anon, authenticated;
grant select, insert, update, delete on table public.imported_social_posts to authenticated;
grant select, insert, update, delete on table public.extracted_places to authenticated;

drop policy if exists "Users manage own imported social posts" on public.imported_social_posts;
create policy "Users manage own imported social posts"
  on public.imported_social_posts
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own extracted places" on public.extracted_places;
create policy "Users manage own extracted places"
  on public.extracted_places
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_imported_social_posts_updated_at on public.imported_social_posts;
create trigger set_imported_social_posts_updated_at
  before update on public.imported_social_posts
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_extracted_places_updated_at on public.extracted_places;
create trigger set_extracted_places_updated_at
  before update on public.extracted_places
  for each row
  execute function public.set_updated_at();

create index if not exists imported_social_posts_user_status_idx
  on public.imported_social_posts (user_id, status, created_at desc);

create index if not exists imported_social_posts_trip_id_idx
  on public.imported_social_posts (trip_id);

create index if not exists extracted_places_user_status_idx
  on public.extracted_places (user_id, status, created_at desc);

create index if not exists extracted_places_imported_post_id_idx
  on public.extracted_places (imported_post_id);

create index if not exists extracted_places_trip_id_idx
  on public.extracted_places (trip_id);

create index if not exists extracted_places_user_dedupe_key_idx
  on public.extracted_places (user_id, dedupe_key)
  where dedupe_key is not null and status <> 'dismissed';

insert into storage.buckets (id, name, public)
values ('social-imports', 'social-imports', false)
on conflict (id) do nothing;

drop policy if exists "Users read own social import assets" on storage.objects;
create policy "Users read own social import assets"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'social-imports'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users upload own social import assets" on storage.objects;
create policy "Users upload own social import assets"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'social-imports'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users update own social import assets" on storage.objects;
create policy "Users update own social import assets"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'social-imports'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'social-imports'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users delete own social import assets" on storage.objects;
create policy "Users delete own social import assets"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'social-imports'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
