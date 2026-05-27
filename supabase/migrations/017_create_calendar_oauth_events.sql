create table if not exists public.calendar_oauth_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('google', 'outlook')),
  event_type text not null check (event_type in (
    'oauth_start',
    'oauth_callback_success',
    'oauth_callback_failure',
    'oauth_state_mismatch',
    'oauth_missing_state_cookie',
    'oauth_unsafe_redirect',
    'oauth_token_exchange_error'
  )),
  user_id uuid references auth.users(id) on delete set null,
  connection_id uuid references public.calendar_connections(id) on delete set null,
  request_path text,
  redirect_to text,
  state_nonce_hash text,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.calendar_oauth_events enable row level security;

drop policy if exists "Users read own calendar oauth events" on public.calendar_oauth_events;
create policy "Users read own calendar oauth events"
  on public.calendar_oauth_events
  for select
  to authenticated
  using (auth.uid() = user_id);

create index if not exists calendar_oauth_events_created_at_idx
  on public.calendar_oauth_events (created_at desc);

create index if not exists calendar_oauth_events_provider_type_idx
  on public.calendar_oauth_events (provider, event_type, created_at desc);

create or replace view public.calendar_oauth_kpis_24h
with (security_invoker = true)
as
select
  provider,
  count(*) filter (where event_type = 'oauth_start') as starts,
  count(*) filter (where event_type = 'oauth_callback_success') as callback_successes,
  count(*) filter (where event_type = 'oauth_callback_failure') as callback_failures,
  count(*) filter (where event_type = 'oauth_state_mismatch') as state_mismatches,
  count(*) filter (where event_type = 'oauth_missing_state_cookie') as missing_state_cookies,
  count(*) filter (where event_type = 'oauth_unsafe_redirect') as unsafe_redirects,
  round(
    100.0 * count(*) filter (where event_type = 'oauth_callback_failure')
    / nullif(count(*) filter (where event_type in ('oauth_callback_success', 'oauth_callback_failure')), 0),
    2
  ) as callback_failure_rate_pct
from public.calendar_oauth_events
where created_at >= now() - interval '24 hours'
group by provider;

create or replace view public.calendar_oauth_failure_trend_7d
with (security_invoker = true)
as
select
  date_trunc('hour', created_at) as bucket,
  provider,
  count(*) filter (where event_type = 'oauth_callback_failure') as callback_failures,
  count(*) filter (where event_type = 'oauth_state_mismatch') as state_mismatches,
  count(*) filter (where event_type = 'oauth_missing_state_cookie') as missing_state_cookies,
  count(*) filter (where event_type = 'oauth_unsafe_redirect') as unsafe_redirects,
  count(*) filter (where event_type = 'oauth_token_exchange_error') as token_exchange_errors
from public.calendar_oauth_events
where created_at >= now() - interval '7 days'
group by 1, 2
order by 1 desc, 2 asc;

create or replace view public.calendar_oauth_redirect_anomalies_7d
with (security_invoker = true)
as
select
  created_at,
  provider,
  event_type,
  redirect_to,
  request_path,
  error_code,
  error_message,
  metadata
from public.calendar_oauth_events
where created_at >= now() - interval '7 days'
  and event_type in ('oauth_unsafe_redirect', 'oauth_state_mismatch', 'oauth_missing_state_cookie')
order by created_at desc;

revoke all on public.calendar_oauth_events from anon, authenticated;
grant select on public.calendar_oauth_events to authenticated;

revoke all on public.calendar_oauth_kpis_24h from anon, authenticated;
revoke all on public.calendar_oauth_failure_trend_7d from anon, authenticated;
revoke all on public.calendar_oauth_redirect_anomalies_7d from anon, authenticated;
