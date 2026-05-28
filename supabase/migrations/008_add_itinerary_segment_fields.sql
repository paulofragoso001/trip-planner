do $$
begin
  if to_regclass('public.trip_segments') is not null then
    alter table public.trip_segments
      add column if not exists provider text,
      add column if not exists confirmation_code text,
      add column if not exists booking_url text;

    create index if not exists trip_segments_trip_id_kind_idx
      on public.trip_segments (trip_id, kind);
  end if;
end $$;
