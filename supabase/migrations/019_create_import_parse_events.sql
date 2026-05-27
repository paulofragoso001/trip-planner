create table if not exists public.import_parse_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  unfiled_item_id uuid references public.unfiled_items(id) on delete set null,

  event_type text not null
    check (event_type in ('prediction', 'correction', 'promotion', 'dismissal')),
  source_type text not null default 'manual',
  source_label text,

  parser_name text not null default 'wayline_rules',
  parser_version text not null default 'v1',
  predicted_segment_type text,
  final_segment_type text,
  confidence numeric(4, 3),

  input_excerpt text,
  predicted_payload jsonb not null default '{}'::jsonb,
  previous_payload jsonb not null default '{}'::jsonb,
  final_payload jsonb not null default '{}'::jsonb,
  correction_payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

alter table public.import_parse_events enable row level security;

drop policy if exists "Users can read own import parse events" on public.import_parse_events;
create policy "Users can read own import parse events"
  on public.import_parse_events
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create own import parse events" on public.import_parse_events;
create policy "Users can create own import parse events"
  on public.import_parse_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create index if not exists import_parse_events_user_id_created_at_idx
  on public.import_parse_events (user_id, created_at desc);

create index if not exists import_parse_events_unfiled_item_id_idx
  on public.import_parse_events (unfiled_item_id);

create index if not exists import_parse_events_event_type_idx
  on public.import_parse_events (event_type, created_at desc);
