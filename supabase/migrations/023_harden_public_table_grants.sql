revoke all on table public.trips from anon, authenticated;
revoke all on table public.trip_segments from anon, authenticated;
revoke all on table public.unfiled_items from anon, authenticated;
revoke all on table public.import_sources from anon, authenticated;
revoke all on table public.calendar_connections from anon, authenticated;
revoke all on table public.calendar_connection_tokens from anon, authenticated;
revoke all on table public.calendar_connection_calendars from anon, authenticated;
revoke all on table public.calendar_sync_jobs from anon, authenticated;
revoke all on table public.calendar_sync_items from anon, authenticated;
revoke all on table public.calendar_oauth_events from anon, authenticated;
revoke all on table public.budget_records from anon, authenticated;
revoke all on table public.trip_collaborators from anon, authenticated;
revoke all on table public.trip_collaboration_invites from anon, authenticated;
revoke all on table public.feedback from anon, authenticated;
revoke all on table public.import_parse_events from anon, authenticated;
revoke all on table public.import_parse_anomaly_reviews from anon, authenticated;

grant select, insert, update, delete on table public.trips to authenticated;
grant select, insert, update, delete on table public.trip_segments to authenticated;
grant select, insert, update, delete on table public.unfiled_items to authenticated;
grant select, insert, update on table public.import_sources to authenticated;

grant select on table public.calendar_connections to authenticated;
grant select on table public.calendar_connection_calendars to authenticated;
grant select on table public.calendar_sync_jobs to authenticated;
grant select on table public.calendar_sync_items to authenticated;
grant select on table public.calendar_oauth_events to authenticated;

grant select, insert, update, delete on table public.budget_records to authenticated;
grant select, insert, update, delete on table public.trip_collaborators to authenticated;
grant select, insert, update, delete on table public.trip_collaboration_invites to authenticated;
grant select, insert on table public.feedback to authenticated;

grant select, insert on table public.import_parse_events to authenticated;
grant select, insert, update on table public.import_parse_anomaly_reviews to authenticated;

revoke all on table public.calendar_oauth_kpis_24h from anon, authenticated;
revoke all on table public.calendar_oauth_failure_trend_7d from anon, authenticated;
revoke all on table public.calendar_oauth_redirect_anomalies_7d from anon, authenticated;
revoke all on table public.import_parse_kpis_24h from anon, authenticated;
revoke all on table public.import_parse_accuracy_7d from anon, authenticated;
revoke all on table public.import_parse_recent_events from anon, authenticated;

grant select on table public.calendar_oauth_kpis_24h to authenticated;
grant select on table public.calendar_oauth_failure_trend_7d to authenticated;
grant select on table public.calendar_oauth_redirect_anomalies_7d to authenticated;
grant select on table public.import_parse_kpis_24h to authenticated;
grant select on table public.import_parse_accuracy_7d to authenticated;
grant select on table public.import_parse_recent_events to authenticated;
