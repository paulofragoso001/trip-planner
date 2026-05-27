create table if not exists public.import_parse_anomaly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  anomaly_fingerprint text not null,
  anomaly_label text not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'false_positive', 'resolved')),
  note text null,

  detected_at timestamptz not null,
  reviewed_at timestamptz null,
  resolved_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, anomaly_fingerprint)
);

alter table public.import_parse_anomaly_reviews enable row level security;

drop policy if exists "import_parse_anomaly_reviews_select_own"
  on public.import_parse_anomaly_reviews;
create policy "import_parse_anomaly_reviews_select_own"
  on public.import_parse_anomaly_reviews
  for select
  using (auth.uid() = user_id);

drop policy if exists "import_parse_anomaly_reviews_insert_own"
  on public.import_parse_anomaly_reviews;
create policy "import_parse_anomaly_reviews_insert_own"
  on public.import_parse_anomaly_reviews
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "import_parse_anomaly_reviews_update_own"
  on public.import_parse_anomaly_reviews;
create policy "import_parse_anomaly_reviews_update_own"
  on public.import_parse_anomaly_reviews
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_import_parse_anomaly_reviews_updated_at
  on public.import_parse_anomaly_reviews;
create trigger set_import_parse_anomaly_reviews_updated_at
  before update on public.import_parse_anomaly_reviews
  for each row
  execute function public.set_updated_at();

create index if not exists idx_import_parse_anomaly_reviews_user_created
  on public.import_parse_anomaly_reviews(user_id, created_at desc);

create index if not exists idx_import_parse_anomaly_reviews_fingerprint
  on public.import_parse_anomaly_reviews(anomaly_fingerprint);

create index if not exists idx_import_parse_anomaly_reviews_status_detected
  on public.import_parse_anomaly_reviews(status, detected_at desc);

revoke all on public.import_parse_anomaly_reviews from anon;
revoke all on public.import_parse_anomaly_reviews from authenticated;
grant select, insert, update on public.import_parse_anomaly_reviews to authenticated;
