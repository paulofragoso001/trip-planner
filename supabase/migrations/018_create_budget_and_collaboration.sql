create table if not exists public.budget_records (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  segment_id uuid references public.trip_segments(id) on delete set null,
  category text not null default 'misc',
  label text not null,
  amount numeric(12, 2) not null default 0,
  currency text not null default 'USD',
  record_type text not null default 'actual'
    check (record_type in ('planned', 'actual')),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.budget_records enable row level security;

drop policy if exists "Trip owners manage budget records" on public.budget_records;
create policy "Trip owners manage budget records"
  on public.budget_records
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.trips
      where trips.id = budget_records.trip_id
        and trips.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.trips
      where trips.id = budget_records.trip_id
        and trips.user_id = auth.uid()
    )
  );

drop trigger if exists set_budget_records_updated_at on public.budget_records;
create trigger set_budget_records_updated_at
  before update on public.budget_records
  for each row
  execute function public.set_updated_at();

create index if not exists budget_records_trip_id_category_idx
  on public.budget_records (trip_id, category);

create index if not exists budget_records_user_id_created_at_idx
  on public.budget_records (user_id, created_at desc);

create table if not exists public.trip_collaborators (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  email text,
  role text not null default 'viewer'
    check (role in ('owner', 'editor', 'commenter', 'viewer')),
  status text not null default 'active'
    check (status in ('active', 'pending', 'revoked')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or email is not null)
);

alter table public.trip_collaborators enable row level security;

drop policy if exists "Trip participants read collaborators" on public.trip_collaborators;
create policy "Trip participants read collaborators"
  on public.trip_collaborators
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.trips
      where trips.id = trip_collaborators.trip_id
        and trips.user_id = auth.uid()
    )
  );

drop policy if exists "Trip owners manage collaborators" on public.trip_collaborators;
create policy "Trip owners manage collaborators"
  on public.trip_collaborators
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.trips
      where trips.id = trip_collaborators.trip_id
        and trips.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.trips
      where trips.id = trip_collaborators.trip_id
        and trips.user_id = auth.uid()
    )
  );

drop trigger if exists set_trip_collaborators_updated_at on public.trip_collaborators;
create trigger set_trip_collaborators_updated_at
  before update on public.trip_collaborators
  for each row
  execute function public.set_updated_at();

create unique index if not exists trip_collaborators_trip_user_unique
  on public.trip_collaborators (trip_id, user_id)
  where user_id is not null;

create unique index if not exists trip_collaborators_trip_email_unique
  on public.trip_collaborators (trip_id, lower(email))
  where email is not null;

create index if not exists trip_collaborators_trip_id_idx
  on public.trip_collaborators (trip_id);

create table if not exists public.trip_collaboration_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  email text not null,
  role text not null default 'viewer'
    check (role in ('editor', 'commenter', 'viewer')),
  token_hash text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trip_collaboration_invites enable row level security;

drop policy if exists "Trip owners manage collaboration invites" on public.trip_collaboration_invites;
create policy "Trip owners manage collaboration invites"
  on public.trip_collaboration_invites
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.trips
      where trips.id = trip_collaboration_invites.trip_id
        and trips.user_id = auth.uid()
    )
  )
  with check (
    invited_by = auth.uid()
    and exists (
      select 1
      from public.trips
      where trips.id = trip_collaboration_invites.trip_id
        and trips.user_id = auth.uid()
    )
  );

drop trigger if exists set_trip_collaboration_invites_updated_at on public.trip_collaboration_invites;
create trigger set_trip_collaboration_invites_updated_at
  before update on public.trip_collaboration_invites
  for each row
  execute function public.set_updated_at();

create unique index if not exists trip_collaboration_invites_pending_unique
  on public.trip_collaboration_invites (trip_id, lower(email))
  where status = 'pending';

create index if not exists trip_collaboration_invites_trip_id_idx
  on public.trip_collaboration_invites (trip_id);
