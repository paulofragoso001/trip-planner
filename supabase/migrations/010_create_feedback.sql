create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  context text not null default 'timeline',
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists "Users can create own feedback" on public.feedback;
create policy "Users can create own feedback"
  on public.feedback
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own feedback" on public.feedback;
create policy "Users can read own feedback"
  on public.feedback
  for select
  to authenticated
  using (auth.uid() = user_id);

create index if not exists feedback_trip_id_context_idx
  on public.feedback (trip_id, context, created_at desc);

create index if not exists feedback_user_id_idx
  on public.feedback (user_id);
