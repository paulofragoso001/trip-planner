alter table public.trip_segments
  drop constraint if exists trip_segments_location_status_check;

alter table public.trip_segments
  add constraint trip_segments_location_status_check
  check (
    location_status in (
      'resolved',
      'unresolved',
      'needs_location_confirmation',
      'needs_activity_provider',
      'wrong_city_rejected',
      'provider_failed',
      'manual_location_required'
    )
  );

update public.trip_segments
set location_status = 'needs_activity_provider',
    provider_metadata = coalesce(provider_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'activityCandidate', true,
        'locationDiagnostics', jsonb_build_object(
          'attemptedAt', now(),
          'provider', 'wayline',
          'query', title,
          'destinationContext', location,
          'status', 'needs_activity_provider',
          'rejectionReason', null,
          'providerResultCount', 0,
          'selectedProviderPlaceId', null,
          'selectedFormattedAddress', null,
          'retryCount', 0,
          'lastErrorCode', null,
          'lastErrorMessageSafe', null
        )
      )
where location_status = 'needs_location_confirmation'
  and (
    coalesce(provider_metadata->>'activityCandidate', 'false') = 'true'
    or title ~* '(boat tour|tour|cruise|guided|excursion|experience|meeting point|provider)'
  );
