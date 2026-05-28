create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete cascade,
  trip_segment_id uuid references public.trip_segments(id) on delete set null,
  type text not null default 'general',
  title text not null default 'Notification',
  body text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists trip_id uuid references public.trips(id) on delete cascade,
  add column if not exists trip_segment_id uuid,
  add column if not exists type text not null default 'general',
  add column if not exists title text not null default 'Notification',
  add column if not exists body text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists read_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notifications'
      and column_name = 'content'
  ) then
    execute 'update public.notifications set body = coalesce(body, content) where body is null and content is not null';
    execute 'update public.notifications set title = coalesce(nullif(title, ''Notification''), left(content, 120), ''Notification'') where content is not null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notifications'
      and column_name = 'is_read'
  ) then
    execute 'update public.notifications set read_at = coalesce(read_at, created_at) where read_at is null and is_read = true';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notifications'
      and column_name = 'itinerary_item_id'
  ) then
    execute $sql$
      update public.notifications
      set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('legacy_itinerary_item_id', itinerary_item_id)
      where itinerary_item_id is not null
    $sql$;
  end if;
end $$;

alter table public.notifications
  drop column if exists itinerary_item_id,
  drop column if exists content,
  drop column if exists is_read;

delete from public.notifications
where user_id is null;

alter table public.notifications
  alter column user_id set not null,
  alter column type set default 'general',
  alter column type set not null,
  alter column title set default 'Notification',
  alter column title set not null,
  alter column metadata set default '{}'::jsonb,
  alter column metadata set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notifications_trip_segment_id_fkey'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
      add constraint notifications_trip_segment_id_fkey
      foreign key (trip_segment_id)
      references public.trip_segments(id)
      on delete set null;
  end if;
end $$;

alter table public.notifications enable row level security;

revoke all on table public.notifications from anon;
revoke all on table public.notifications from authenticated;
grant select, insert, update, delete on table public.notifications to authenticated;

drop policy if exists "Users can read own notifications" on public.notifications;
drop policy if exists "Users see own notifications" on public.notifications;
create policy "Users see own notifications"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications"
  on public.notifications for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Authenticated users can create notifications" on public.notifications;
create policy "Authenticated users can create notifications"
  on public.notifications for insert
  to authenticated
  with check (auth.uid() = user_id);

create index if not exists notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_id_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create index if not exists notifications_trip_id_idx
  on public.notifications (trip_id);

create index if not exists notifications_trip_segment_id_idx
  on public.notifications (trip_segment_id);
