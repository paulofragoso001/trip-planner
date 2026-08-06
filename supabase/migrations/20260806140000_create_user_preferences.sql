create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_currency text not null default 'USD' check (default_currency in ('USD', 'EUR', 'GBP', 'BRL', 'JPY', 'CAD')),
  distance_unit text not null default 'miles' check (distance_unit in ('miles', 'kilometers')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_preferences enable row level security;
revoke all on table public.user_preferences from anon, authenticated;
grant select, insert, update on table public.user_preferences to authenticated;
create policy "Users select own preferences" on public.user_preferences for select to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy "Users insert own preferences" on public.user_preferences for insert to authenticated with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy "Users update own preferences" on public.user_preferences for update to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = user_id) with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create or replace function public.set_user_preferences_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger set_user_preferences_updated_at before update on public.user_preferences for each row execute procedure public.set_user_preferences_updated_at();
-- Manual rollback, only after rolling back the application:
-- drop trigger if exists set_user_preferences_updated_at on public.user_preferences;
-- drop function if exists public.set_user_preferences_updated_at();
-- drop table if exists public.user_preferences;
