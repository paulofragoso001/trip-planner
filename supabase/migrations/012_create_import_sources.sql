create table if not exists public.import_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null,
  connected boolean not null default false,
  source_label text,
  last_synced_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_type)
);

alter table public.import_sources
add column if not exists source_type text not null default 'email',
add column if not exists connected boolean not null default false,
add column if not exists source_label text,
add column if not exists last_synced_at timestamptz,
add column if not exists last_error text,
add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.import_sources enable row level security;

drop policy if exists "Users can read their import sources" on public.import_sources;
create policy "Users can read their import sources"
  on public.import_sources for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their import sources" on public.import_sources;
create policy "Users can create their import sources"
  on public.import_sources for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their import sources" on public.import_sources;
create policy "Users can update their import sources"
  on public.import_sources for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_import_sources_updated_at on public.import_sources;
create trigger set_import_sources_updated_at
  before update on public.import_sources
  for each row
  execute function public.set_updated_at();

create index if not exists import_sources_user_id_source_type_idx
  on public.import_sources (user_id, source_type);
