create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text null,
  reason text null,
  status text not null default 'requested'
    check (status in ('requested', 'in_review', 'completed', 'cancelled')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, status)
);

alter table public.account_deletion_requests enable row level security;

revoke all on table public.account_deletion_requests from anon, authenticated;
grant select, insert on table public.account_deletion_requests to authenticated;

drop policy if exists "Users read own account deletion requests"
  on public.account_deletion_requests;
create policy "Users read own account deletion requests"
  on public.account_deletion_requests
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users create own account deletion requests"
  on public.account_deletion_requests;
create policy "Users create own account deletion requests"
  on public.account_deletion_requests
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create index if not exists account_deletion_requests_user_id_idx
  on public.account_deletion_requests (user_id);

create index if not exists account_deletion_requests_status_requested_at_idx
  on public.account_deletion_requests (status, requested_at desc);
