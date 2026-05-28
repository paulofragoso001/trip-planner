alter table public.trips
add column if not exists travel_style text not null default 'balanced';

alter table public.trips
drop constraint if exists trips_travel_style_check;

alter table public.trips
add constraint trips_travel_style_check
check (
  travel_style in (
    'balanced',
    'relaxed',
    'packed',
    'food_focused',
    'culture_focused',
    'outdoors',
    'nightlife',
    'family_friendly'
  )
);
