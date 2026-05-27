create or replace view public.import_parse_kpis_24h
with (security_invoker = true)
as
select
  parser_name,
  parser_version,
  source_type,
  count(*) filter (where event_type = 'prediction') as predictions,
  count(*) filter (where event_type = 'correction') as corrections,
  count(*) filter (where event_type = 'promotion') as promotions,
  count(*) filter (where event_type = 'dismissal') as dismissals,
  round(
    100.0 * count(*) filter (where event_type = 'correction')
    / nullif(count(*) filter (where event_type in ('correction', 'promotion', 'dismissal')), 0),
    2
  ) as correction_rate_pct,
  round(
    100.0 * count(*) filter (where event_type = 'dismissal')
    / nullif(count(*) filter (where event_type in ('correction', 'promotion', 'dismissal')), 0),
    2
  ) as dismissal_rate_pct
from public.import_parse_events
where created_at >= now() - interval '24 hours'
group by parser_name, parser_version, source_type;

create or replace view public.import_parse_accuracy_7d
with (security_invoker = true)
as
select
  parser_name,
  parser_version,
  source_type,
  count(*) filter (
    where event_type in ('correction', 'promotion', 'dismissal')
      and predicted_segment_type is not null
      and final_segment_type is not null
  ) as reviewed_events,
  count(*) filter (
    where event_type in ('correction', 'promotion', 'dismissal')
      and predicted_segment_type is not null
      and final_segment_type is not null
      and predicted_segment_type = final_segment_type
  ) as matching_segment_type_events,
  round(
    100.0 * count(*) filter (
      where event_type in ('correction', 'promotion', 'dismissal')
        and predicted_segment_type is not null
        and final_segment_type is not null
        and predicted_segment_type = final_segment_type
    )
    / nullif(
      count(*) filter (
        where event_type in ('correction', 'promotion', 'dismissal')
          and predicted_segment_type is not null
          and final_segment_type is not null
      ),
      0
    ),
    2
  ) as segment_type_accuracy_pct
from public.import_parse_events
where created_at >= now() - interval '7 days'
group by parser_name, parser_version, source_type;

create or replace view public.import_parse_recent_events
with (security_invoker = true)
as
select
  created_at,
  event_type,
  source_type,
  source_label,
  parser_name,
  parser_version,
  predicted_segment_type,
  final_segment_type,
  confidence,
  correction_payload
from public.import_parse_events
order by created_at desc;

revoke all on public.import_parse_kpis_24h from anon, authenticated;
revoke all on public.import_parse_accuracy_7d from anon, authenticated;
revoke all on public.import_parse_recent_events from anon, authenticated;
