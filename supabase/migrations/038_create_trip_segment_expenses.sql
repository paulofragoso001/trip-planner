do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'currency_code'
  ) then
    create type public.currency_code as enum ('USD', 'EUR', 'GBP', 'BRL', 'JPY', 'CAD');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'expense_category'
  ) then
    create type public.expense_category as enum (
      'transport',
      'lodging',
      'dining',
      'activity',
      'shopping',
      'other'
    );
  end if;
end $$;

create table if not exists public.trip_segment_expenses (
  id uuid primary key default gen_random_uuid(),
  segment_id uuid not null references public.trip_segments(id) on delete cascade,
  title varchar(255) not null,
  amount_cents integer not null check (amount_cents > 0),
  currency public.currency_code not null default 'USD',
  category public.expense_category not null default 'other',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trip_segment_expenses enable row level security;

drop policy if exists "Trip participants read segment expenses" on public.trip_segment_expenses;
create policy "Trip participants read segment expenses"
  on public.trip_segment_expenses
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.trip_segments
      join public.trips on trips.id = trip_segments.trip_id
      where trip_segments.id = trip_segment_expenses.segment_id
        and (
          trips.user_id = (select auth.uid())
          or exists (
            select 1
            from public.trip_collaborators
            where trip_collaborators.trip_id = trips.id
              and trip_collaborators.user_id = (select auth.uid())
              and trip_collaborators.status = 'active'
          )
        )
    )
  );

drop policy if exists "Trip editors insert segment expenses" on public.trip_segment_expenses;
create policy "Trip editors insert segment expenses"
  on public.trip_segment_expenses
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.trip_segments
      join public.trips on trips.id = trip_segments.trip_id
      where trip_segments.id = trip_segment_expenses.segment_id
        and (
          trips.user_id = (select auth.uid())
          or exists (
            select 1
            from public.trip_collaborators
            where trip_collaborators.trip_id = trips.id
              and trip_collaborators.user_id = (select auth.uid())
              and trip_collaborators.status = 'active'
              and trip_collaborators.role in ('owner', 'editor')
          )
        )
    )
  );

drop policy if exists "Trip editors update segment expenses" on public.trip_segment_expenses;
create policy "Trip editors update segment expenses"
  on public.trip_segment_expenses
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.trip_segments
      join public.trips on trips.id = trip_segments.trip_id
      where trip_segments.id = trip_segment_expenses.segment_id
        and (
          trips.user_id = (select auth.uid())
          or exists (
            select 1
            from public.trip_collaborators
            where trip_collaborators.trip_id = trips.id
              and trip_collaborators.user_id = (select auth.uid())
              and trip_collaborators.status = 'active'
              and trip_collaborators.role in ('owner', 'editor')
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.trip_segments
      join public.trips on trips.id = trip_segments.trip_id
      where trip_segments.id = trip_segment_expenses.segment_id
        and (
          trips.user_id = (select auth.uid())
          or exists (
            select 1
            from public.trip_collaborators
            where trip_collaborators.trip_id = trips.id
              and trip_collaborators.user_id = (select auth.uid())
              and trip_collaborators.status = 'active'
              and trip_collaborators.role in ('owner', 'editor')
          )
        )
    )
  );

drop policy if exists "Trip editors delete segment expenses" on public.trip_segment_expenses;
create policy "Trip editors delete segment expenses"
  on public.trip_segment_expenses
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.trip_segments
      join public.trips on trips.id = trip_segments.trip_id
      where trip_segments.id = trip_segment_expenses.segment_id
        and (
          trips.user_id = (select auth.uid())
          or exists (
            select 1
            from public.trip_collaborators
            where trip_collaborators.trip_id = trips.id
              and trip_collaborators.user_id = (select auth.uid())
              and trip_collaborators.status = 'active'
              and trip_collaborators.role in ('owner', 'editor')
          )
        )
    )
  );

drop trigger if exists set_trip_segment_expenses_updated_at on public.trip_segment_expenses;
create trigger set_trip_segment_expenses_updated_at
  before update on public.trip_segment_expenses
  for each row
  execute function public.set_updated_at();

create index if not exists trip_segment_expenses_segment_id_idx
  on public.trip_segment_expenses (segment_id);

create index if not exists trip_segment_expenses_category_idx
  on public.trip_segment_expenses (category);

create index if not exists trip_segment_expenses_created_at_idx
  on public.trip_segment_expenses (created_at desc);

revoke all on table public.trip_segment_expenses from anon, authenticated;
grant select, insert, update, delete on table public.trip_segment_expenses to authenticated;
