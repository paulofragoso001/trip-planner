create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_comments boolean default true,
  inapp_comments boolean default true,
  email_mentions boolean default true,
  inapp_mentions boolean default true,
  created_at timestamp default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "Users can read own notification preferences" on public.notification_preferences;
drop policy if exists "Users can update own notification preferences" on public.notification_preferences;
drop policy if exists "Users can create own notification preferences" on public.notification_preferences;
drop policy if exists "Users manage own preferences" on public.notification_preferences;
create policy "Users manage own preferences"
  on public.notification_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.create_notification_preferences()
returns trigger
language plpgsql
as $$
begin
  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_user_created_preferences on auth.users;
create trigger on_user_created_preferences
  after insert on auth.users
  for each row
  execute procedure public.create_notification_preferences();
