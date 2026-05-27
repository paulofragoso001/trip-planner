revoke all on public.import_parse_events from anon;
revoke all on public.import_parse_events from authenticated;
grant select, insert on public.import_parse_events to authenticated;

revoke all on public.import_parse_kpis_24h from anon;
revoke all on public.import_parse_accuracy_7d from anon;
revoke all on public.import_parse_recent_events from anon;

grant select on public.import_parse_kpis_24h to authenticated;
grant select on public.import_parse_accuracy_7d to authenticated;
grant select on public.import_parse_recent_events to authenticated;
