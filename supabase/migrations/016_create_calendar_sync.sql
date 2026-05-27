create extension if not exists pgcrypto;

do $$
begin
  create extension if not exists vault with schema vault;
exception
  when feature_not_supported or insufficient_privilege or undefined_file then
    raise notice 'Skipping optional vault extension; calendar tokens use server-side encrypted ciphertext columns.';
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'calendar_job_status') then
    create type public.calendar_job_status as enum (
      'queued',
      'running',
      'succeeded',
      'failed',
      'retry_wait',
      'blocked'
    );
  end if;
end $$;

create table if not exists public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  provider text not null check (provider in ('google', 'outlook')),
  provider_account_id text not null,
  provider_account_email text,
  provider_account_name text,

  status text not null default 'active'
    check (status in ('active', 'needs_reauth', 'revoked', 'error')),

  token_family_id uuid not null default gen_random_uuid(),
  current_token_version integer not null default 1,
  token_rotation_locked_at timestamptz,
  token_rotation_lock_owner text,

  default_calendar_id text,
  default_calendar_name text,

  scopes text[] not null default '{}'::text[],
  calendar_events_scope text,

  last_synced_at timestamptz,
  last_error text,

  sync_version text,
  provider_cursor text,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (provider, provider_account_id),
  unique (user_id, provider)
);

create table if not exists public.calendar_connection_tokens (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.calendar_connections(id) on delete cascade,

  token_version integer not null,
  is_current boolean not null default true,

  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,

  token_nonce text not null,
  token_key_id text not null,

  rotated_from_token_id uuid references public.calendar_connection_tokens(id) on delete set null,
  rotated_at timestamptz,
  revoked_at timestamptz,
  reuse_detected_at timestamptz,

  created_at timestamptz not null default now(),

  unique (connection_id, token_version)
);

create unique index if not exists calendar_connection_tokens_one_current_idx
  on public.calendar_connection_tokens (connection_id)
  where is_current;

create table if not exists public.calendar_connection_calendars (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.calendar_connections(id) on delete cascade,

  provider_calendar_id text not null,
  calendar_name text,
  is_primary boolean not null default false,
  is_selected boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (connection_id, provider_calendar_id)
);

create table if not exists public.calendar_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.calendar_connections(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,

  idempotency_key text not null,
  job_type text not null check (job_type in ('initial_sync', 'incremental_sync', 'reconcile', 'delete')),
  status public.calendar_job_status not null default 'queued',

  attempt_count integer not null default 0,
  max_attempts integer not null default 6,

  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  lock_expires_at timestamptz,

  backoff_seconds integer not null default 30,
  last_error text,
  conflict_reason text,

  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (idempotency_key)
);

create table if not exists public.calendar_sync_items (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.calendar_connections(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,

  source_type text not null check (source_type in ('itinerary_item', 'trip_segment')),
  source_id uuid not null,

  provider_event_id text,
  provider_calendar_id text,
  provider_event_etag text,
  wayline_sync_version text,
  wayline_updated_at timestamptz,

  event_title text not null,
  event_start timestamptz not null,
  event_end timestamptz,
  event_payload jsonb not null default '{}'::jsonb,

  sync_status text not null default 'pending'
    check (sync_status in ('pending', 'synced', 'stale', 'deleted', 'error')),

  last_synced_at timestamptz,
  last_error text,
  conflict_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (connection_id, source_type, source_id),
  unique (connection_id, provider_event_id)
);

alter table public.calendar_connections enable row level security;
alter table public.calendar_connection_tokens enable row level security;
alter table public.calendar_connection_calendars enable row level security;
alter table public.calendar_sync_jobs enable row level security;
alter table public.calendar_sync_items enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop policy if exists "Users read own calendar connections" on public.calendar_connections;
create policy "Users read own calendar connections"
  on public.calendar_connections
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users read own calendar connection calendars" on public.calendar_connection_calendars;
create policy "Users read own calendar connection calendars"
  on public.calendar_connection_calendars
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.calendar_connections
      where calendar_connections.id = calendar_connection_calendars.connection_id
        and calendar_connections.user_id = auth.uid()
    )
  );

drop policy if exists "Users read own calendar sync jobs" on public.calendar_sync_jobs;
create policy "Users read own calendar sync jobs"
  on public.calendar_sync_jobs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.calendar_connections
      where calendar_connections.id = calendar_sync_jobs.connection_id
        and calendar_connections.user_id = auth.uid()
    )
  );

drop policy if exists "Users read own calendar sync items" on public.calendar_sync_items;
create policy "Users read own calendar sync items"
  on public.calendar_sync_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.calendar_connections
      where calendar_connections.id = calendar_sync_items.connection_id
        and calendar_connections.user_id = auth.uid()
    )
  );

drop trigger if exists set_calendar_connections_updated_at on public.calendar_connections;
create trigger set_calendar_connections_updated_at
  before update on public.calendar_connections
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_calendar_connection_calendars_updated_at on public.calendar_connection_calendars;
create trigger set_calendar_connection_calendars_updated_at
  before update on public.calendar_connection_calendars
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_calendar_sync_jobs_updated_at on public.calendar_sync_jobs;
create trigger set_calendar_sync_jobs_updated_at
  before update on public.calendar_sync_jobs
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_calendar_sync_items_updated_at on public.calendar_sync_items;
create trigger set_calendar_sync_items_updated_at
  before update on public.calendar_sync_items
  for each row
  execute function public.set_updated_at();

create index if not exists calendar_connections_user_id_idx
  on public.calendar_connections (user_id);

create index if not exists calendar_connections_status_idx
  on public.calendar_connections (status);

create index if not exists calendar_connection_tokens_connection_current_idx
  on public.calendar_connection_tokens (connection_id, is_current, token_version desc);

create index if not exists calendar_connection_calendars_connection_id_idx
  on public.calendar_connection_calendars (connection_id);

create index if not exists calendar_sync_jobs_claim_idx
  on public.calendar_sync_jobs (status, available_at, created_at)
  where status in ('queued', 'retry_wait');

create index if not exists calendar_sync_jobs_connection_id_idx
  on public.calendar_sync_jobs (connection_id);

create index if not exists calendar_sync_jobs_status_idx
  on public.calendar_sync_jobs (status);

create index if not exists calendar_sync_items_trip_id_idx
  on public.calendar_sync_items (trip_id);

create index if not exists calendar_sync_items_source_idx
  on public.calendar_sync_items (source_type, source_id);

create index if not exists calendar_sync_items_status_idx
  on public.calendar_sync_items (sync_status);

create index if not exists calendar_sync_items_wayline_sync_version_idx
  on public.calendar_sync_items (wayline_sync_version);

create or replace function public.claim_calendar_sync_job(
  p_locked_by text,
  p_lock_seconds integer default 300
)
returns setof public.calendar_sync_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.calendar_sync_jobs%rowtype;
begin
  update public.calendar_sync_jobs
  set
    attempt_count = attempt_count + 1,
    locked_at = now(),
    locked_by = p_locked_by,
    lock_expires_at = now() + make_interval(secs => p_lock_seconds),
    status = 'running',
    updated_at = now()
  where id = (
    select id
    from public.calendar_sync_jobs
    where status in ('queued', 'retry_wait')
      and available_at <= now()
      and (lock_expires_at is null or lock_expires_at <= now())
      and attempt_count < max_attempts
    order by available_at asc, created_at asc
    for update skip locked
    limit 1
  )
  returning * into v_job;

  if found then
    return next v_job;
  end if;

  return;
end;
$$;

revoke all on function public.claim_calendar_sync_job(text, integer) from public;
grant execute on function public.claim_calendar_sync_job(text, integer) to service_role;

create or replace function public.lock_calendar_connection_rotation(
  p_connection_id uuid,
  p_owner text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_rows integer;
begin
  update public.calendar_connections
  set
    token_rotation_locked_at = now(),
    token_rotation_lock_owner = p_owner,
    updated_at = now()
  where id = p_connection_id
    and (
      token_rotation_locked_at is null
      or token_rotation_locked_at < now() - interval '2 minutes'
    );

  get diagnostics updated_rows = row_count;
  return updated_rows = 1;
end;
$$;

create or replace function public.unlock_calendar_connection_rotation(
  p_connection_id uuid,
  p_owner text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.calendar_connections
  set
    token_rotation_locked_at = null,
    token_rotation_lock_owner = null,
    updated_at = now()
  where id = p_connection_id
    and token_rotation_lock_owner = p_owner;
end;
$$;

revoke all on function public.lock_calendar_connection_rotation(uuid, text) from public;
revoke all on function public.unlock_calendar_connection_rotation(uuid, text) from public;
grant execute on function public.lock_calendar_connection_rotation(uuid, text) to service_role;
grant execute on function public.unlock_calendar_connection_rotation(uuid, text) to service_role;
