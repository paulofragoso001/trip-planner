create table if not exists public.api_error_events (
  id uuid primary key default gen_random_uuid(),
  route text not null,
  status integer not null,
  error_name text null,
  error_message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.api_error_events enable row level security;

revoke all on table public.api_error_events from anon, authenticated;

create index if not exists api_error_events_created_at_idx
  on public.api_error_events (created_at desc);

create index if not exists api_error_events_route_created_at_idx
  on public.api_error_events (route, created_at desc);
