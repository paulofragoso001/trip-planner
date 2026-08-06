type HealthCheck = { ok: boolean };

export function areCoreHealthChecksHealthy(checks: {
  calendar: HealthCheck;
  env: HealthCheck;
  supabase: HealthCheck;
  travelProviders: HealthCheck;
}) {
  return checks.calendar.ok && checks.env.ok && checks.supabase.ok && checks.travelProviders.ok;
}
