create table if not exists public.unfiled_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  source_type text not null default 'email',
  source_label text,
  raw_text text,
  parsed_payload jsonb not null default '{}'::jsonb,
  parse_status text not null default 'needs_review',
  parse_confidence numeric(4, 3),
  title text,
  location text,
  date_time timestamptz,
  segment_type text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.unfiled_items
add column if not exists trip_id uuid references public.trips(id) on delete set null,
add column if not exists source_type text not null default 'email',
add column if not exists source_label text,
add column if not exists raw_text text,
add column if not exists parsed_payload jsonb not null default '{}'::jsonb,
add column if not exists parse_status text not null default 'needs_review',
add column if not exists parse_confidence numeric(4, 3),
add column if not exists title text,
add column if not exists location text,
add column if not exists date_time timestamptz,
add column if not exists segment_type text,
add column if not exists notes text;

alter table public.unfiled_items enable row level security;

drop policy if exists "Users can read their unfiled items" on public.unfiled_items;
create policy "Users can read their unfiled items"
  on public.unfiled_items for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their unfiled items" on public.unfiled_items;
create policy "Users can create their unfiled items"
  on public.unfiled_items for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their unfiled items" on public.unfiled_items;
create policy "Users can update their unfiled items"
  on public.unfiled_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their unfiled items" on public.unfiled_items;
create policy "Users can delete their unfiled items"
  on public.unfiled_items for delete
  using (auth.uid() = user_id);

drop trigger if exists set_unfiled_items_updated_at on public.unfiled_items;
create trigger set_unfiled_items_updated_at
  before update on public.unfiled_items
  for each row
  execute function public.set_updated_at();

create index if not exists unfiled_items_user_id_status_idx
  on public.unfiled_items (user_id, parse_status, created_at desc);

create index if not exists unfiled_items_user_id_trip_id_idx
  on public.unfiled_items (user_id, trip_id);
