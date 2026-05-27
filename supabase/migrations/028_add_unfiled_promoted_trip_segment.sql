alter table public.unfiled_items
add column if not exists promoted_trip_segment_id uuid
  references public.trip_segments(id) on delete set null;

create index if not exists unfiled_items_promoted_trip_segment_id_idx
  on public.unfiled_items (promoted_trip_segment_id);
